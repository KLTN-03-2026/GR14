import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';

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

    const params = new URLSearchParams(location.search);
    const responseCode = params.get('vnp_ResponseCode');

    // ✅ Detect deposit qua sessionStorage thay vì txnRef
    // sessionStorage.setItem('lastDepositId') được set trước khi redirect sang VNPay
    const depositId = sessionStorage.getItem('lastDepositId');
    const isDepositCallback = Boolean(depositId);

    if (responseCode === '00') {
      setStatus('success');
      setTimeout(() => {
        if (isDepositCallback) {
          // Giữ lại sessionStorage để PaymentResultPage đọc depositId
          // Forward toàn bộ query string để PaymentResultPage kiểm tra vnp_ResponseCode
          navigate(`/payment/result${location.search}`, { replace: true });
        } else {
          navigate('/payment/success', { replace: true });
        }
      }, 1500);
    } else {
      setStatus('error');
      setErrorMessage(getVNPayErrorMessage(responseCode));

      // ✅ Xóa depositId khi thất bại để tránh lưu thừa
      if (isDepositCallback) {
        sessionStorage.removeItem('lastDepositId');
      }

      setTimeout(() => {
        navigate('/payment/failed', { replace: true });
      }, 1500);
    }

    setLoading(false);
  }, []);

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