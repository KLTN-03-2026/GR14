import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Spin, Modal, Empty, Alert } from 'antd';
import toast from 'react-hot-toast';
import {
    CheckCircleOutlined,
    CrownOutlined,
    ThunderboltOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import { paymentApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';

type UpgradeMode = 'account' | 'post';

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
    packageType: string;
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


const POST_VIP_FEATURES: Record<number, string[]> = {
    3: [
        'Bài đăng được làm nổi bật 3 ngày',
        'Ưu tiên hiển thị hơn tin thường',
        'Huy hiệu VIP trên bài đăng',
    ],
    7: [
        'Bài đăng nổi bật 7 ngày',
        'Hiển thị ưu tiên trong kết quả tìm kiếm',
        'Huy hiệu VIP trên bài đăng',
        'Cơ hội xuất hiện trang chủ',
    ],
    15: [
        'Bài đăng nổi bật 15 ngày',
        'Ưu tiên hiển thị cao trong danh sách',
        'Xuất hiện trên trang chủ',
        'Xem thống kê lượt xem bài',
        'Huy hiệu VIP trên bài đăng',
    ],
    30: [
        'Bài đăng nổi bật 30 ngày',
        'Ưu tiên cao nhất trong danh sách',
        'Xuất hiện vị trí nổi bật trang chủ',
        'Tự động làm mới tin mỗi ngày',
        'Xem thống kê chi tiết (lượt xem, quan tâm)',
        'Hiển thị nhãn "Tin gấp"',
        'Huy hiệu VIP trên bài đăng',
    ],
};

const ACCOUNT_VIP_FEATURES: Record<number, string[]> = {
    3: [
        'Tất cả bài đăng đều được nổi bật 3 ngày',
        'Đăng tin không giới hạn trong thời gian VIP',
        'Định giá bất động sản bằng AI',
        'Tra cứu Phong thủy không giới hạn',
        'Huy hiệu VIP Basic trên hồ sơ',
    ],
    7: [
        'Tất cả bài đăng nổi bật 7 ngày',
        'Đăng tin không giới hạn',
        'Ưu tiên hiển thị toàn bộ bài',
        'Định giá bất động sản bằng AI',
        'Tra cứu Phong thủy không giới hạn',
        'Nhãn nổi bật/Featured',
        'Huy hiệu VIP Standard trên hồ sơ',
    ],
    15: [
        'Tất cả bài đăng nổi bật 15 ngày',
        'Đăng tin không giới hạn',
        'Ưu tiên hiển thị cao',
        'Xuất hiện trang chủ',
        'Định giá bất động sản bằng AI',
        'Tra cứu Phong thủy không giới hạn',
        'Xem thống kê bài đăng',
        'Nhãn nổi bật/Featured',
        'Huy hiệu VIP Pro trên hồ sơ',
    ],
    30: [
        'Tất cả bài đăng nổi bật 30 ngày',
        'Đăng tin không giới hạn',
        'Ưu tiên cao nhất toàn bộ bài',
        'Xuất hiện vị trí nổi bật trang chủ',
        'Định giá bất động sản bằng AI',
        'Tra cứu Phong thủy không giới hạn',
        'Tự động làm mới tin mỗi ngày',
        'Thống kê chi tiết',
        'Gắn nhãn Khẩn / Tin gấp cho tất cả bài',
        'Huy hiệu VIP Premium trên hồ sơ',
    ],
};

const DEFAULT_FEATURES = ['Ưu tiên hiển thị', 'Huy hiệu VIP', 'Tiếp cận nhiều khách hơn'];

const TIER_STYLE: Record<number, { accent: string; bg: string }> = {
    0: { accent: '#2563eb', bg: '#eff6ff' },
    1: { accent: '#2563eb', bg: '#eff6ff' },
    2: { accent: '#7c3aed', bg: '#f5f3ff' },
    3: { accent: '#d97706', bg: '#fffbeb' },
};

const VIPUpgradePage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const postId = searchParams.get('postId') ? Number(searchParams.get('postId')) : undefined;
    const postTitle = searchParams.get('postTitle') || undefined;

    // mode được đọc từ URL param, mặc định là 'post' nếu có postId
    const modeParam = searchParams.get('mode') as UpgradeMode | null;
    const mode: UpgradeMode = modeParam ?? (postId ? 'post' : 'account');

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
            const raw: VipPackage[] = res.data?.data || [];
            setPackages(raw.filter((p) => p.durationDays > 1));
        } catch {
            toast.error('Không thể tải danh sách gói VIP');
        } finally {
            setLoading(false);
        }
    };

    // Switch tab — giữ nguyên postId & postTitle trên URL, chỉ đổi mode
    const switchMode = (newMode: UpgradeMode) => {
        const next = new URLSearchParams(searchParams);
        next.set('mode', newMode);
        setSearchParams(next, { replace: true });
    };



    const handleCheckout = (packageId: number) => {
        if (!user) { toast('Vui lòng đăng nhập trước'); return; }
        const pkg = packages.find((p) => p.id === packageId);
        if (!pkg) return;
        setCheckoutData({ packageId, vipPackage: pkg });
        setPaymentMethod('');
        setShowPaymentModal(true);
    };

    const handlePayment = async () => {
        if (!paymentMethod) { toast('Vui lòng chọn phương thức thanh toán'); return; }
        if (!checkoutData || !user) { toast.error('Dữ liệu không hợp lệ'); return; }

        try {
            setIsProcessing(true);
            const payload: any = {
                packageId: checkoutData.packageId,
                paymentType: mode === 'post' ? 'POST_VIP' : 'ACCOUNT_VIP',
                paymentMethod: paymentMethod as 'vnpay' | 'momo',
                returnUrl: paymentMethod === 'momo'
                    ? `${import.meta.env.VITE_API_URL}/payment/momo/callback`
                    : window.location.origin + '/payment/vnpay-callback',
            };
            if (mode === 'post' && postId) payload.postId = postId;

            const res = await paymentApi.createPayment(payload);
            const paymentData = res?.data?.data || res?.data || {};
            const paymentUrl = paymentData?.paymentUrl;
            if (!paymentUrl) throw new Error('Không nhận được URL thanh toán');

            if (paymentData?.paymentId != null) {
                sessionStorage.setItem('lastPaymentId', String(paymentData.paymentId));
            }
            window.location.href = paymentUrl;
        } catch (error: any) {
            toast.error(error?.message || error?.response?.data?.message || 'Có lỗi xảy ra');
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
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: '#fff', border: '1px solid #e5e7eb',
                        borderRadius: 100, padding: '5px 16px', marginBottom: 16,
                    }}>
                        <CrownOutlined style={{ color: '#d97706', fontSize: 14 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', letterSpacing: 0.4 }}>
                            NÂNG CẤP VIP
                        </span>
                    </div>

                    <h1 style={{ fontSize: 30, fontWeight: 800, color: '#111827', margin: '0 0 10px' }}>
                        {mode === 'post' ? 'Nổi bật từng bài đăng' : 'Nâng cấp tài khoản VIP'}
                    </h1>

                    {/* Tên bài khi mode=post */}
                    {postTitle && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: '#fffbeb', border: '1px solid #fde68a',
                            borderRadius: 10, padding: '7px 14px', marginBottom: 14,
                        }}>
                            <FileTextOutlined style={{ color: '#d97706', fontSize: 13 }} />
                            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
                                {postTitle}
                            </span>
                        </div>
                    )}

                    <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
                        {mode === 'post'
                            ? 'Chọn thời gian nổi bật — kích hoạt ngay sau khi thanh toán'
                            : 'Toàn bộ bài đăng hiện tại và mới đều được ưu tiên'}
                    </p>

                    {/* ── Tab switch ── */}
                    <div style={{
                        display: 'inline-flex',
                        background: '#f1f5f9',
                        borderRadius: 100,
                        padding: 4,
                        gap: 4,
                    }}>
                        {/* Tab "Nâng cấp bài" — chỉ hiện khi có postId */}
                        {postId && (
                            <button
                                onClick={() => switchMode('post')}
                                style={{
                                    padding: '7px 20px', borderRadius: 100,
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    border: 'none', transition: 'all 0.2s',
                                    background: mode === 'post' ? '#d97706' : 'transparent',
                                    color: mode === 'post' ? '#fff' : '#6b7280',
                                    boxShadow: mode === 'post' ? '0 2px 8px #d9770630' : 'none',
                                }}
                            >
                                Nâng cấp bài này
                            </button>
                        )}
                        <button
                            onClick={() => switchMode('account')}
                            style={{
                                padding: '7px 20px', borderRadius: 100,
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                border: 'none', transition: 'all 0.2s',
                                background: mode === 'account' ? '#254b86' : 'transparent',
                                color: mode === 'account' ? '#fff' : '#6b7280',
                                boxShadow: mode === 'account' ? '0 2px 8px #254b8630' : 'none',
                            }}
                        >
                            Nâng cấp tài khoản
                        </button>
                    </div>
                </div>

                {/* ── Banner so sánh (chỉ hiện khi có postId để user biết sự khác biệt) ── */}
                {postId && (
                    <div style={{
                        background: mode === 'account' ? '#eff6ff' : '#fffbeb',
                        border: `1px solid ${mode === 'account' ? '#bfdbfe' : '#fde68a'}`,
                        borderRadius: 12, padding: '12px 18px', marginBottom: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, flexWrap: 'wrap',
                    }}>
                        {mode === 'post' ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <CrownOutlined style={{ color: '#d97706', fontSize: 16 }} />
                                    <span style={{ fontSize: 13, color: '#92400e' }}>
                                        Có nhiều bài? <strong>Nâng cấp tài khoản</strong> tiết kiệm hơn — tất cả bài đều được VIP.
                                    </span>
                                </div>
                                <button
                                    onClick={() => switchMode('account')}
                                    style={{
                                        fontSize: 12, fontWeight: 600, color: '#254b86',
                                        background: 'transparent', border: '1px solid #254b86',
                                        borderRadius: 100, padding: '4px 14px', cursor: 'pointer',
                                    }}
                                >
                                    Xem gói tài khoản
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FileTextOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                                    <span style={{ fontSize: 13, color: '#1e40af' }}>
                                        Chỉ muốn nổi bật 1 bài? <strong>Nâng cấp từng bài</strong> với giá thấp hơn.
                                    </span>
                                </div>
                                <button
                                    onClick={() => switchMode('post')}
                                    style={{
                                        fontSize: 12, fontWeight: 600, color: '#d97706',
                                        background: 'transparent', border: '1px solid #d97706',
                                        borderRadius: 100, padding: '4px 14px', cursor: 'pointer',
                                    }}
                                >
                                    Xem gói từng bài
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ── Danh sách gói ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 20,
                    alignItems: 'stretch',
                }}>
                    {packages.filter(p => p.packageType === (mode === 'post' ? 'POST_VIP' : 'ACCOUNT_VIP')).map((pkg) => {
                        const tier = TIER_STYLE[pkg.priorityLevel] ?? TIER_STYLE[1];
                        const isPopular = pkg.priorityLevel === 3;
                        const price = Number(pkg.price);
                        
                        let features: string[] = DEFAULT_FEATURES;
                        try {
                            if (pkg.features && typeof pkg.features === 'string') {
                                const parsed = JSON.parse(pkg.features);
                                const isAccount = pkg.packageType === 'ACCOUNT_VIP';
                                features = [
                                    parsed.highlight 
                                        ? (isAccount ? 'Nổi bật TẤT CẢ bài đăng' : 'Làm nổi bật bài đăng') 
                                        : null,
                                    isAccount ? 'Đăng tin không giới hạn' : null,
                                    isAccount ? 'Định giá bất động sản bằng AI' : null,
                                    isAccount ? 'Tra cứu Phong thủy không giới hạn' : null,
                                    parsed.topPost ? 'Ưu tiên hiển thị cao' : null,
                                    parsed.featured ? 'Nhãn nổi bật/Featured' : null,
                                    parsed.urgent ? 'Gắn nhãn Khẩn / Tin gấp' : null,
                                    parsed.badge ? `Huy hiệu ${parsed.badge}` : null,
                                ].filter(Boolean) as string[];
                            } else if (Array.isArray(pkg.features)) {
                                features = pkg.features;
                            }
                        } catch {
                            // Fallback to mode specific default features map if parsing fails
                            const featMap = mode === 'post' ? POST_VIP_FEATURES : ACCOUNT_VIP_FEATURES;
                            features = featMap[pkg.durationDays] ?? DEFAULT_FEATURES;
                        }

                        const displayTier = getDisplayVipTier(pkg.priorityLevel);

                        return (
                            <div key={pkg.id} style={{
                                background: '#fff',
                                border: isPopular ? `2px solid ${tier.accent}` : '1px solid #e5e7eb',
                                borderRadius: 14, padding: '28px 22px 22px',
                                position: 'relative',
                                boxShadow: isPopular ? `0 4px 20px ${tier.accent}20` : '0 1px 6px rgba(0,0,0,0.04)',
                                display: 'flex', flexDirection: 'column',
                                height: '100%', boxSizing: 'border-box',
                            }}>
                                {isPopular && (
                                    <div style={{ position: 'absolute', top: -13, left: 20 }}>
                                        <span style={{
                                            background: tier.accent, color: '#fff',
                                            fontSize: 11, fontWeight: 700,
                                            padding: '3px 12px', borderRadius: 100,
                                        }}>
                                            <ThunderboltOutlined style={{ marginRight: 4, fontSize: 10 }} />
                                            PHỔ BIẾN NHẤT
                                        </span>
                                    </div>
                                )}

                                <div style={{ marginBottom: 16 }}>
                                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                                        {pkg.name}
                                    </h2>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: tier.accent, margin: '0 0 5px' }}>
                                        {mode === 'post'
                                            ? `Nổi bật ${pkg.durationDays} ngày`
                                            : `Hạng VIP ${displayTier}`}
                                    </p>
                                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                                        {pkg.description || `Gói VIP ${pkg.durationDays} ngày`}
                                    </p>
                                </div>

                                {/* Giá */}
                                <div style={{ background: tier.bg, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span style={{ fontSize: 32, fontWeight: 800, color: tier.accent, lineHeight: 1 }}>
                                            {(price / 1000).toFixed(0)}K
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#4b5563' }}>
                                            / {pkg.durationDays} ngày
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                                        ≈ {Math.round(price / pkg.durationDays / 1000)}K mỗi ngày
                                    </p>
                                </div>

                                {/* Features */}
                                <div style={{ flex: 1, marginBottom: 18 }}>
                                    <p style={{
                                        fontSize: 11, fontWeight: 700, color: '#9ca3af',
                                        textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px',
                                    }}>
                                        Bao gồm
                                    </p>
                                    {features.map((f, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 8,
                                            marginBottom: i < features.length - 1 ? 8 : 0,
                                        }}>
                                            <CheckCircleOutlined style={{ color: tier.accent, fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.45 }}>{f}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleCheckout(pkg.id)}
                                    style={{
                                        width: '100%', height: 44, marginTop: 'auto',
                                        background: isPopular ? tier.accent : 'transparent',
                                        color: isPopular ? '#fff' : tier.accent,
                                        border: `1.5px solid ${tier.accent}`,
                                        borderRadius: 9, fontSize: 14, fontWeight: 700,
                                        cursor: 'pointer', transition: 'opacity 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                >
                                    {mode === 'post' ? `Nổi bật ${pkg.durationDays} ngày` : 'Đăng ký gói này'}
                                </button>
                            </div>
                        );
                    })}
                </div>

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
                width={440}
            >
                {checkoutData && (() => {
                    const price = Number(checkoutData.vipPackage.price);
                    return (
                        <div style={{ paddingTop: 8 }}>
                            <div style={{
                                background: '#f8fafc', borderRadius: 10,
                                padding: '14px 16px', margin: '16px 0 20px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, color: '#6b7280' }}>Loại nâng cấp</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: mode === 'post' ? '#d97706' : '#254b86' }}>
                                        {mode === 'post' ? 'VIP từng bài' : 'VIP tài khoản'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, color: '#6b7280' }}>Gói</span>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{checkoutData.vipPackage.name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, color: '#6b7280' }}>Thời hạn</span>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                                        {checkoutData.vipPackage.durationDays} ngày
                                    </span>
                                </div>
                                {mode === 'post' && postTitle && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 13, color: '#6b7280' }}>Bài đăng</span>
                                        <span style={{
                                            fontSize: 13, fontWeight: 600, maxWidth: 200,
                                            textAlign: 'right', color: '#374151',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {postTitle}
                                        </span>
                                    </div>
                                )}
                                <div style={{ height: 1, background: '#e5e7eb', margin: '10px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tổng tiền</span>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>
                                        {price.toLocaleString('vi-VN')} ₫
                                    </span>
                                </div>
                            </div>

                            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>
                                Phương thức thanh toán
                            </p>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                                {[
                                    { key: 'vnpay', label: 'VNPay', sub: 'ATM · QR · Visa · Master', color: '#005bac' },
                                    { key: 'momo', label: 'MoMo', sub: 'Ví điện tử MoMo', color: '#ae2070' },
                                ].map((m) => (
                                    <div key={m.key} onClick={() => setPaymentMethod(m.key)} style={{
                                        flex: 1, border: paymentMethod === m.key ? `2px solid ${m.color}` : '1.5px solid #e5e7eb',
                                        borderRadius: 10, padding: '12px 8px', textAlign: 'center',
                                        cursor: 'pointer', background: paymentMethod === m.key ? `${m.color}0d` : '#fff',
                                        transition: 'all 0.15s',
                                    }}>
                                        <p style={{ fontWeight: 700, color: m.color, margin: '0 0 3px', fontSize: 15 }}>{m.label}</p>
                                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{m.sub}</p>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button block onClick={() => { setShowPaymentModal(false); setPaymentMethod(''); }} style={{ height: 42 }}>
                                    Hủy
                                </Button>
                                <Button block type="primary" loading={isProcessing}
                                    disabled={!paymentMethod} onClick={handlePayment}
                                    style={{ height: 42, fontWeight: 700 }}>
                                    Thanh toán ngay
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* ── Modal kết quả ── */}
            <Modal
                title={resultStatus === 'success' ? '✅ Thanh toán thành công' : '❌ Thanh toán thất bại'}
                open={showResultModal}
                onCancel={() => { setShowResultModal(false); if (resultStatus === 'success') navigate('/my-posts'); }}
                footer={
                    <Button
                        type={resultStatus === 'success' ? 'primary' : 'default'}
                        onClick={() => { setShowResultModal(false); if (resultStatus === 'success') navigate('/my-posts'); }}
                    >
                        {resultStatus === 'success' ? 'Xem bài đăng' : 'Quay lại'}
                    </Button>
                }
            >
                {resultStatus === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <CheckCircleOutlined style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                        <h3 style={{ margin: '0 0 6px', color: '#111827' }}>
                            {mode === 'post' ? 'Bài đăng đã được nâng VIP!' : 'Nâng cấp VIP thành công!'}
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: 14 }}>
                            {mode === 'post'
                                ? 'Bài đăng của bạn đã được ưu tiên hiển thị.'
                                : 'Tài khoản đã được kích hoạt. Bắt đầu đăng tin ngay!'}
                        </p>
                        {paymentResult && (
                            <div style={{
                                textAlign: 'left', background: '#f0fdf4',
                                border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginTop: 12,
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
                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>Giao dịch không thành công. Vui lòng thử lại.</p>
                        <Alert message="Nếu bạn đã chuyển tiền, vui lòng chờ vài phút." type="info" showIcon />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default VIPUpgradePage;