import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { paymentApi } from '@/api';

function getVNPayErrorMessage(responseCode: string | null): string {
  const errorCodes: Record<string, string> = {
    '24': 'Bạn đã hủy giao dịch thanh toán.',
    '11': 'Thẻ/Tài khoản của bạn đã hết hạn.',
    '12': 'Thẻ/Tài khoản của bạn bị khóa.',
    '51': 'Tài khoản của bạn không đủ số dư.',
    '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày.',
    '75': 'Ngân hàng thanh toán đang bảo trì.',
    '99': 'Lỗi không xác định từ VNPay.',
  };
  return responseCode
    ? (errorCodes[responseCode] || 'Giao dịch thất bại.')
    : 'Giao dịch thất bại.';
}

const VNPayCallbackPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'error'>('error');
  const [errorMessage, setErrorMessage] = useState('');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const responseCode = params.get('vnp_ResponseCode');
      const depositId = sessionStorage.getItem('lastDepositId');
      const isDepositCallback = Boolean(depositId);

      try {
        const res = await paymentApi.verifyVNPayReturn(location.search);
        const isSuccess = responseCode === '00' && res.data?.success !== false;

        if (isSuccess) {
          setStatus('success');
          setLoading(false);
          setTimeout(() => {
            if (isDepositCallback) {
              navigate(`/payment/result${location.search}`, { replace: true });
            } else {
              navigate('/payment/success', { replace: true });
            }
          }, 500);
          return;
        }

        setStatus('error');
        setErrorMessage(getVNPayErrorMessage(responseCode));
        if (isDepositCallback) {
          sessionStorage.removeItem('lastDepositId');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Không thể xác nhận thanh toán với hệ thống. Vui lòng thử lại hoặc liên hệ hỗ trợ.');
      } finally {
        setLoading(false);
      }

      setTimeout(() => {
        navigate('/payment/failed', { replace: true });
      }, 1500);
    };

    handleCallback();
  }, [location.search, navigate]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#666' }}>
          Đang xử lý kết quả thanh toán...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
    >
      {status === 'success' ? (
        <Result status="success" title="Thanh toán thành công!" subTitle="Đang chuyển hướng..." />
      ) : (
        <Result
          status="error"
          title="Thanh toán thất bại"
          subTitle={errorMessage}
          extra={[
            <Button key="back" type="primary" onClick={() => navigate('/appointment')}>
              Quay lại lịch hẹn
            </Button>,
            <Button key="vip" onClick={() => navigate('/vip-upgrade')}>
              Nâng cấp VIP
            </Button>,
          ]}
        />
      )}
    </div>
  );
};

export default VNPayCallbackPage;
