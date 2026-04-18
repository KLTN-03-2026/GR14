import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spin } from 'antd';
import toast from 'react-hot-toast';
import {
  CheckCircleOutlined,
  CalendarOutlined,
  CrownOutlined,
  HomeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { paymentApi } from '@/api';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPaymentDetails();
  }, []);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      const lastPaymentId =
        sessionStorage.getItem('lastPaymentId') || localStorage.getItem('lastPaymentId');

      if (lastPaymentId) {
        const res = await paymentApi.getPaymentById(parseInt(lastPaymentId));
        setPaymentData(res.data?.data);
        sessionStorage.removeItem('lastPaymentId');
        localStorage.removeItem('lastPaymentId');
      } else {
        const res = await paymentApi.getMyPayments({ limit: 1 });
        const payments = res.data?.data || [];
        if (payments.length === 0) {
          setError(true);
          return;
        }
        setPaymentData(payments[0]);
      }
    } catch {
      setError(true);
      toast.error('Không thể tải thông tin thanh toán');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', gap: 12,
      }}>
        <Spin size="large" />
        <span style={{ color: '#9ca3af' }}>Đang tải thông tin...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '100vh', gap: 16,
      }}>
        <p style={{ color: '#6b7280' }}>Không thể tải thông tin thanh toán.</p>
        <Button type="primary" onClick={() => navigate('/')}>Về trang chủ</Button>
      </div>
    );
  }

  const pkg = paymentData?.subscription?.package;
  const endDate = paymentData?.subscription?.endDate
    ? new Date(paymentData.subscription.endDate).toLocaleDateString('vi-VN')
    : null;

  const parseFeatures = (features: any): string[] => {
    if (!features) return [];
    if (Array.isArray(features)) return features;
    if (typeof features === 'string') {
      try {
        const parsed = JSON.parse(features);
        return Array.isArray(parsed) ? parsed : [features];
      } catch {
        return [features];
      }
    }
    return [];
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '48px 20px 64px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Thông báo thành công */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '36px 28px',
          textAlign: 'center', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)', marginBottom: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#f0fdf4', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a' }} />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
            Thanh toán thành công!
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            Tài khoản VIP của bạn đã được kích hoạt
          </p>
        </div>

        {/* Chi tiết gói */}
        {paymentData && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '24px 24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)', marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 18px' }}>
              Chi tiết gói VIP
            </h2>

            {/* Gói & hạn */}
            <div style={{
              background: '#fffbeb', borderRadius: 10, padding: '14px 16px', marginBottom: 18,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CrownOutlined style={{ fontSize: 20, color: '#d97706' }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#111827' }}>
                    {pkg?.name || 'Gói VIP'}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
                    {pkg?.durationDays} ngày sử dụng
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>
                {Number(paymentData.amount || 0).toLocaleString('vi-VN')} ₫
              </span>
            </div>

            {/* Ngày hết hạn */}
            {endDate && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 0', borderBottom: '1px solid #f1f5f9',
                marginBottom: 14,
              }}>
                <CalendarOutlined style={{ color: '#6b7280', fontSize: 16 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Hết hạn vào</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{endDate}</p>
                </div>
              </div>
            )}

            {/* Features */}
            {parseFeatures(pkg?.features).length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 10px' }}>
                  Quyền lợi bao gồm
                </p>
                {parseFeatures(pkg.features).map((f: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thông tin giao dịch */}
        {paymentData && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '20px 24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)', marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>
              Thông tin giao dịch
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
              {[
                { label: 'Mã thanh toán', value: `#${paymentData.id}` },
                { label: 'Mã giao dịch', value: paymentData.transactionId || '—' },
                {
                  label: 'Phương thức',
                  value: (paymentData.paymentMethod || '').toUpperCase(),
                },
                {
                  label: 'Ngày thanh toán',
                  value: paymentData.paidAt
                    ? new Date(paymentData.paidAt).toLocaleString('vi-VN')
                    : '—',
                },
              ].map((item) => (
                <div key={item.label}>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút điều hướng */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            block
            size="large"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            style={{ height: 44, fontWeight: 600 }}
          >
            Về trang chủ
          </Button>
          <Button
            block
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/posts/new')}
            style={{ height: 44, fontWeight: 600 }}
          >
            Đăng tin ngay
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;