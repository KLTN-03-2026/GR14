import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Spin, Result, Card, Divider } from 'antd';
import toast from 'react-hot-toast';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  HomeOutlined,
} from '@ant-design/icons';

import { useDeposit } from '../../hooks/useDeposit';
import DepositStatusBadge from '../public/DepositStatusBadge';

const fmtAmount = (val: string | number | null | undefined): string => {
  if (!val) return '—';
  return Number(val).toLocaleString('vi-VN') + ' ₫';
};

const PaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Lấy thông tin từ URL (callback từ VNPay & MoMo)
  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const momoResultCode = searchParams.get('resultCode');           // ← Bổ sung cho MoMo
  const momoMessage = searchParams.get('message');                 // ← Thông báo lỗi từ MoMo (nếu có)

  const depositIdFromParam = searchParams.get('depositId');
  const depositIdFromStorage = sessionStorage.getItem('lastDepositId');

  const resolvedDepositId = depositIdFromParam || depositIdFromStorage;
  const isDepositPayment = Boolean(resolvedDepositId);

  // Hook lấy chi tiết deposit
  const { getDepositDetail } = useDeposit();
  const { data: depositResponse, isLoading: depositLoading } = getDepositDetail(
    resolvedDepositId ? parseInt(resolvedDepositId) : null
  );

  const deposit = (depositResponse as any)?.data || null;

  useEffect(() => {
    const initializeResult = () => {
      // Xóa sessionStorage ngay để tránh lặp
      if (depositIdFromStorage) {
        sessionStorage.removeItem('lastDepositId');
      }

      if (isDepositPayment) {
        // Kiểm tra thành công từ VNPay hoặc MoMo
        const vnpSuccess = vnpResponseCode === '00';
        const momoSuccess = momoResultCode === '0';

        // Kiểm tra trạng thái từ database (an toàn hơn)
        const statusSuccess = deposit?.status === 1 || deposit?.status === 2;

        const finalSuccess = vnpSuccess || momoSuccess || statusSuccess;

        setIsSuccess(finalSuccess);

        if (!finalSuccess) {
          let msg = 'Giao dịch đặt cọc chưa được xác nhận';

          if (vnpResponseCode && vnpResponseCode !== '00') {
            msg = `VNPay - Mã lỗi: ${vnpResponseCode}`;
          } else if (momoResultCode && momoResultCode !== '0') {
            msg = `MoMo - Mã lỗi: ${momoResultCode}`;
            if (momoMessage) msg += ` - ${momoMessage}`;
          }

          setErrorMsg(msg);
        }
      } else {
        // Thanh toán khác (VIP, nâng cấp bài viết...)
        setIsSuccess(true);
      }

      setLoading(false);
    };

    initializeResult();
  }, [deposit, vnpResponseCode, momoResultCode, momoMessage, isDepositPayment, depositIdFromStorage]);

  // ==================== LOADING STATE ====================
  if (loading || (isDepositPayment && depositLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">Đang kiểm tra kết quả thanh toán...</p>
        </div>
      </div>
    );
  }

  // ==================== KẾT QUẢ ĐẶT CỌC (VNPAY & MOMO) ====================
  if (isDepositPayment) {
    const property = deposit?.appointment?.house || deposit?.appointment?.land;
    const isDepositSuccess = isSuccess;

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="mx-auto max-w-lg">
          <Result
            status={isDepositSuccess ? 'success' : 'error'}
            icon={
              isDepositSuccess ? (
                <CheckCircleOutlined style={{ fontSize: 80, color: '#16a34a' }} />
              ) : (
                <CloseCircleOutlined style={{ fontSize: 80, color: '#ef4444' }} />
              )
            }
            title={
              isDepositSuccess ? 'Đặt cọc thành công!' : 'Thanh toán đặt cọc thất bại'
            }
            subTitle={
              isDepositSuccess
                ? `Giao dịch cọc #${deposit?.id || ''} đã được xác nhận thành công.`
                : errorMsg || 'Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ.'
            }
            extra={[
              <Button
                key="my-appointments"
                type="primary"
                size="large"
                icon={<CalendarOutlined />}
                onClick={() => navigate('/appointment')}
              >
                Xem lịch hẹn của tôi
              </Button>,
              <Button
                key="home"
                size="large"
                icon={<HomeOutlined />}
                onClick={() => navigate('/')}
              >
                Về trang chủ
              </Button>,
            ]}
          />

          {isDepositSuccess && deposit && (
            <Card className="mt-8 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="space-y-5 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Số tiền cọc</span>
                  <span className="text-3xl font-bold text-green-600">
                    {fmtAmount(deposit.amount)}
                  </span>
                </div>

                <Divider />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Trạng thái</p>
                    <DepositStatusBadge status={deposit.status} />
                  </div>
                  <div>
                    <p className="text-gray-500">Loại cọc</p>
                    <p className="font-medium">
                      {deposit.depositType === 'BEFORE_VIEWING'
                        ? 'Giữ chỗ trước khi xem'
                        : 'Cọc chốt mua'}
                    </p>
                  </div>
                </div>

                {property && (
                  <>
                    <Divider />
                    <div>
                      <p className="text-gray-500 mb-2">Bất động sản</p>
                      <p className="font-semibold text-base">{property.title}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        📍 {property.district}, {property.city}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {!isDepositSuccess && (
            <Card className="mt-8" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
              <h3 className="text-red-600 font-semibold mb-3">Giao dịch không thành công</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                <li>Bạn đã hủy thanh toán trên cổng VNPay hoặc MoMo</li>
                <li>Tài khoản không đủ số dư hoặc bị hạn chế</li>
                <li>Kết nối mạng bị gián đoạn trong quá trình thanh toán</li>
              </ul>
              <Button
                danger
                type="primary"
                block
                size="large"
                className="mt-6"
                onClick={() => navigate('/appointment')}
              >
                Quay lại và thử thanh toán lại
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ==================== FALLBACK - Thanh toán khác (VIP,...) ====================
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-lg">
        <Result
          status="success"
          title="Thanh toán thành công!"
          subTitle="Cảm ơn bạn đã sử dụng dịch vụ."
          extra={[
            <Button key="home" type="primary" size="large" onClick={() => navigate('/')}>
              Về trang chủ
            </Button>,
          ]}
        />
      </div>
    </div>
  );
};

export default PaymentResultPage;