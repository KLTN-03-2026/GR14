import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';

const MoMoPayCallbackPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'error'>('error');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const params = new URLSearchParams(location.search);
    const resultCode = params.get('resultCode'); // MoMo dùng resultCode, không phải vnp_ResponseCode

    if (resultCode === '0') {
      setStatus('success');
      setTimeout(() => {
        navigate('/payment/success', { replace: true });
      }, 1500);
    } else {
      setStatus('error');
      setTimeout(() => {
        navigate('/payment/failed', { replace: true });
      }, 1500);
    }

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#666' }}>Đang xử lý kết quả thanh toán MoMo...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      {status === 'success' ? (
        <Result status="success" title="Thanh toán MoMo thành công!" subTitle="Đang chuyển hướng..." />
      ) : (
        <Result
          status="error"
          title="Thanh toán MoMo thất bại"
          subTitle="Giao dịch không thành công. Vui lòng thử lại."
          extra={<Button type="primary" onClick={() => navigate('/vip-upgrade')}>Quay lại</Button>}
        />
      )}
    </div>
  );
};

export default MoMoPayCallbackPage;