import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message, Spin, Modal, Empty, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { paymentApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { parseVipPackageBenefitLines } from '@/utils/vipPackageFeatures';

/** priorityLevel DB: 0=10k, 1=7d → hiển thị VIP 1; 2=15d→VIP2; 3=30d→VIP3 */
function getDisplayVipTier(priorityLevel: number): 1 | 2 | 3 {
  if (priorityLevel >= 3) return 3;
  if (priorityLevel === 2) return 2;
  return 1;
}

interface VipPackage {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  priorityLevel: number;
  features?: string | string[];
}

interface CheckoutData {
  packageId: number;
  vipPackage: VipPackage;
}

interface PaymentResult {
  paymentId: number;
  subscriptionId: number;
  packageName: string;
  amount: number;
  endDate: string;
}

/** Lợi ích theo gói — khớp mô tả VIP1 (10k & 7d) / VIP2 (15d) / VIP3 (30d) */
const FALLBACK_FEATURES: Record<number, string[]> = {
  1: [
    'Tin đăng được hiển thị sau khi được duyệt',
    'Xuất hiện trong danh sách tìm kiếm',
    'Có thể tiếp cận người xem tự nhiên',
  ],
  7: [
    'Tin đăng được làm nổi bật (mức cơ bản) sau khi được duyệt',
    'Ưu tiên hiển thị hơn tin thường',
    'Huy hiệu “VIP 1” hiển thị trong trang quản lý tin cá nhân',
  ],
  15: [
   'Tin đăng được làm nổi bật (highlight) sau khi được duyệt',
    'Ưu tiên hiển thị cao trong danh sách tin',
    'Có cơ hội xuất hiện trên trang chủ',
    'Xem thống kê lượt xem bài đăng',
    'Huy hiệu “VIP 2” hiển thị trong trang quản lý tin cá nhân',
  ],
  30: [
    'Tin đăng được làm nổi bật (highlight) sau khi được duyệt',
    'Ưu tiên hiển thị cao nhất trong danh sách tin',
    'Xuất hiện tại vị trí nổi bật trên trang chủ',
    'Tự động làm mới tin mỗi ngày, giúp tin luôn ở trên cùng',
    'Xem thống kê chi tiết (lượt xem, mức độ quan tâm)',
    'Hiển thị “Tin gấp” giúp bài đăng nổi bật hơn',
    'Huy hiệu “VIP 3” hiển thị trong trang quản lý tin cá nhân',
  ],
};

const DEFAULT_FEATURES = [
  'Đăng tin không giới hạn trong thời gian VIP',
  'Tin hiển thị ưu tiên trên trang chủ',
  'Huy hiệu VIP trên hồ sơ',
  'Tiếp cận nhiều khách hàng hơn',
];

/** Màu theo priorityLevel DB; 0 & 1 cùng tông VIP 1 */
const TIER_STYLE: Record<number, { accent: string; bg: string }> = {
  0: { accent: '#2563eb', bg: '#eff6ff' },
  1: { accent: '#2563eb', bg: '#eff6ff' },
  2: { accent: '#7c3aed', bg: '#f5f3ff' },
  3: { accent: '#d97706', bg: '#fffbeb' },
};

const VIPUpgradePage = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<VipPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult] = useState<PaymentResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultStatus] = useState<'success' | 'failed'>('success');
  const { user } = useAuthStore();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await paymentApi.getPackages({ limit: 100 });
      setPackages(res.data?.data || []);
    } catch {
      message.error('Không thể tải danh sách gói VIP');
    } finally {
      setLoading(false);
    }
  };

  const getFeatures = (pkg: VipPackage): string[] => {
    // Ưu tiên nội dung mô tả do frontend định nghĩa theo từng gói (theo yêu cầu nghiệp vụ/UI)
    const fallbackFeatures = FALLBACK_FEATURES[pkg.durationDays];
    if (fallbackFeatures?.length) {
      return fallbackFeatures;
    }

    if (pkg.features) {
      if (Array.isArray(pkg.features) && pkg.features.length > 0) return pkg.features;
      if (typeof pkg.features === 'string') {
        try {
          const parsed: unknown = JSON.parse(pkg.features);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((x) => String(x));
          }
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const lines = parseVipPackageBenefitLines(parsed as Record<string, unknown>);
            if (lines.length > 0) return lines;
          }
        } catch {
          if (pkg.features.trim()) return [pkg.features];
        }
      }
    }
    return DEFAULT_FEATURES;
  };

  const handleCheckout = (packageId: number) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập trước');
      return;
    }
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;
    setCheckoutData({ packageId, vipPackage: pkg });
    setPaymentMethod('');
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      message.warning('Vui lòng chọn phương thức thanh toán');
      return;
    }
    if (!checkoutData || !user) {
      message.error('Dữ liệu không hợp lệ. Vui lòng thử lại.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await paymentApi.createPayment({
        packageId: checkoutData.packageId,
        paymentType: 'ACCOUNT_VIP',
        paymentMethod: paymentMethod as 'vnpay' | 'momo',
        returnUrl: window.location.origin + '/payment/vnpay-callback',
      });

      const paymentData = res?.data?.data || res?.data || {};
      const paymentUrl = paymentData?.paymentUrl;

      if (!paymentUrl) throw new Error('Không nhận được URL thanh toán từ hệ thống');

      if (paymentData?.paymentId != null) {
        sessionStorage.setItem('lastPaymentId', String(paymentData.paymentId));
      }

      window.location.href = paymentUrl;
    } catch (error: any) {
      message.error(
        error?.message || error?.response?.data?.message || 'Có lỗi xảy ra khi tạo giao dịch'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && packages.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 12 }}>
        <Spin size="large" />
        <span style={{ color: '#9ca3af' }}>Đang tải...</span>
      </div>
    );
  }

  if (!loading && packages.length === 0) {
    return <Empty description="Không có gói VIP nào" style={{ marginTop: 80 }} />;
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '48px 20px 64px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 100, padding: '5px 16px', marginBottom: 20,
          }}>
            <CrownOutlined style={{ color: '#d97706', fontSize: 14 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', letterSpacing: 0.4 }}>
              TÀI KHOẢN VIP
            </span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 800, color: '#111827',
            margin: '0 0 12px', lineHeight: 1.25,
          }}>
            Đăng tin không giới hạn
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
            Chọn gói phù hợp — kích hoạt ngay sau khi thanh toán thành công
          </p>
        </div>

        {/* ── Danh sách gói ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          alignItems: 'stretch',
        }}>
          {packages.map((pkg) => {
            const tier = TIER_STYLE[pkg.priorityLevel] ?? TIER_STYLE[1];
            const isPopular = pkg.priorityLevel === 3;
            const features = getFeatures(pkg);
            const displayTier =
             pkg.durationDays <= 1 ? 0 : getDisplayVipTier(pkg.priorityLevel);

            return (
              <div
                key={pkg.id}
                style={{
                  background: '#fff',
                  border: isPopular ? `2px solid ${tier.accent}` : '1px solid #e5e7eb',
                  borderRadius: 14,
                  padding: '28px 22px 22px',
                  position: 'relative',
                  boxShadow: isPopular
                    ? `0 4px 20px ${tier.accent}20`
                    : '0 1px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: 0,
                  boxSizing: 'border-box',
                }}
              >
                {/* Badge phổ biến */}
                {isPopular && (
                  <div style={{ position: 'absolute', top: -13, left: 20 }}>
                    <span style={{
                      background: tier.accent,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 12px',
                      borderRadius: 100,
                    }}>
                      <ThunderboltOutlined style={{ marginRight: 4, fontSize: 10 }} />
                      PHỔ BIẾN NHẤT
                    </span>
                  </div>
                )}

                {/* Tên & mô tả */}
                <div style={{ marginBottom: 18 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>
                    {pkg.name}
                  </h2>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: displayTier === 0 ? '#6b7280' : tier.accent, // VIP 0 màu xám
                      margin: '0 0 6px',
                    }}
                  >
                    {displayTier === 0 ? 'VIP 0 (gói theo tin)' : `Hạng VIP ${displayTier}`}
                  </p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                    {pkg.description || `Gói VIP ${pkg.durationDays} ngày`}
                  </p>
                </div>

                {/* Giá */}
                <div style={{
                  background: tier.bg, borderRadius: 10,
                  padding: '12px 14px', marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, color: tier.accent, lineHeight: 1 }}>
                      {(pkg.price / 1000).toFixed(0)}K
                    </span>
                    <span
                      style={{
                        fontSize: 15,        // tăng từ 13 → 15
                        fontWeight: 600,     // thêm độ đậm
                        color: '#4b5563',    // đậm hơn chút
                      }}
                    >
                      {pkg.durationDays <= 1 ? '/ lần đăng tin' : `/ ${pkg.durationDays} ngày`}
                    </span>
                  </div>
                  {pkg.durationDays > 1 && (
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                      Tương đương ≈ {Math.round(pkg.price / pkg.durationDays / 1000)}K mỗi ngày
                    </p>
                  )}
                </div>

                {/* Features */}
                <div style={{ flex: 1, marginBottom: 20, minHeight: 0 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: 0.8,
                    margin: '0 0 12px',
                  }}>
                    Bao gồm
                  </p>
                  {features.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      marginBottom: i < features.length - 1 ? 9 : 0,
                    }}>
                      <CheckCircleOutlined style={{
                        color: tier.accent, fontSize: 13,
                        marginTop: 2, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Nút CTA */}
                <button
                  onClick={() => handleCheckout(pkg.id)}
                  style={{
                    width: '100%',
                    height: 44,
                    marginTop: 'auto',
                    flexShrink: 0,
                    background: isPopular ? tier.accent : 'transparent',
                    color: isPopular ? '#fff' : tier.accent,
                    border: `1.5px solid ${tier.accent}`,
                    borderRadius: 9, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Đăng ký gói này
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 36, fontSize: 12, color: '#9ca3af' }}>
          🔒 Thanh toán bảo mật qua VNPay & MoMo · Kích hoạt ngay sau khi thanh toán
        </p>
      </div>

      {/* ── Modal thanh toán ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CrownOutlined style={{ color: '#d97706' }} />
            <span style={{ fontWeight: 700 }}>Xác nhận thanh toán</span>
          </div>
        }
        open={showPaymentModal}
        onCancel={() => { setShowPaymentModal(false); setPaymentMethod(''); }}
        footer={null}
        width={420}
      >
        {/* Tóm tắt đơn hàng */}
        <div style={{
          background: '#f8fafc', borderRadius: 10,
          padding: '14px 16px', margin: '16px 0 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Gói</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{checkoutData?.vipPackage.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Thời hạn</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {checkoutData?.vipPackage.durationDays != null && checkoutData.vipPackage.durationDays <= 1
                ? 'Theo tin (1 ngày hiệu lực)'
                : `${checkoutData?.vipPackage.durationDays} ngày`}
            </span>
          </div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tổng tiền</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>
              {checkoutData?.vipPackage.price.toLocaleString('vi-VN')} ₫
            </span>
          </div>
        </div>

        {/* Phương thức thanh toán */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>
          Phương thức thanh toán
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { key: 'vnpay', label: 'VNPay', sub: 'ATM · QR · Visa · Master', color: '#005bac' },
            { key: 'momo', label: 'MoMo', sub: 'Ví điện tử MoMo', color: '#ae2070' },
          ].map((m) => (
            <div
              key={m.key}
              onClick={() => setPaymentMethod(m.key)}
              style={{
                flex: 1, border: paymentMethod === m.key
                  ? `2px solid ${m.color}` : '1.5px solid #e5e7eb',
                borderRadius: 10, padding: '12px 8px',
                textAlign: 'center', cursor: 'pointer',
                background: paymentMethod === m.key ? `${m.color}0d` : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontWeight: 700, color: m.color, margin: '0 0 3px', fontSize: 15 }}>
                {m.label}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{m.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            block
            onClick={() => { setShowPaymentModal(false); setPaymentMethod(''); }}
            style={{ height: 42 }}
          >
            Hủy
          </Button>
          <Button
            block
            type="primary"
            loading={isProcessing}
            disabled={!paymentMethod}
            onClick={handlePayment}
            style={{ height: 42, fontWeight: 700 }}
          >
            Thanh toán ngay
          </Button>
        </div>
      </Modal>

      {/* ── Modal kết quả ── */}
      <Modal
        title={resultStatus === 'success' ? '✅ Thanh toán thành công' : '❌ Thanh toán thất bại'}
        open={showResultModal}
        onCancel={() => {
          setShowResultModal(false);
          if (resultStatus === 'success') navigate('/');
        }}
        footer={
          <Button
            type={resultStatus === 'success' ? 'primary' : 'default'}
            onClick={() => {
              setShowResultModal(false);
              if (resultStatus === 'success') navigate('/');
            }}
          >
            {resultStatus === 'success' ? 'Về trang chủ' : 'Quay lại'}
          </Button>
        }
      >
        {resultStatus === 'success' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 6px', color: '#111827' }}>Nâng cấp VIP thành công!</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              Tài khoản đã được kích hoạt. Bắt đầu đăng tin ngay!
            </p>
            {paymentResult && (
              <div style={{
                textAlign: 'left', background: '#f0fdf4',
                border: '1px solid #bbf7d0', borderRadius: 10, padding: 16,
              }}>
                <p style={{ margin: '0 0 6px', fontSize: 13 }}><strong>Gói:</strong> {paymentResult.packageName}</p>
                <p style={{ margin: '0 0 6px', fontSize: 13 }}><strong>Số tiền:</strong> {paymentResult.amount.toLocaleString('vi-VN')} ₫</p>
                <p style={{ margin: '0 0 6px', fontSize: 13 }}><strong>Hết hạn:</strong> {paymentResult.endDate}</p>
                <p style={{ margin: 0, fontSize: 13 }}><strong>Mã thanh toán:</strong> #{paymentResult.paymentId}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <ExclamationCircleOutlined style={{ fontSize: 48, color: '#dc2626', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 6px', color: '#111827' }}>Thanh toán thất bại</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              Giao dịch không thành công. Vui lòng thử lại.
            </p>
            <Alert
              message="Nếu bạn đã chuyển tiền, vui lòng chờ vài phút để hệ thống xử lý."
              type="info"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VIPUpgradePage;