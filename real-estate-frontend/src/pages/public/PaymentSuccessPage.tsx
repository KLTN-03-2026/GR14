import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Result, Button, Card, Statistic, Spin, message } from 'antd';
import { CheckCircleOutlined, CalendarOutlined, GiftOutlined } from '@ant-design/icons';
import { paymentApi, postApi } from '@/api';
import { parseVipPackageBenefitLines } from '@/utils';

type Demand = '' | 'SELL' | 'RENT';
type PostTypeApi = 'SELL_HOUSE' | 'SELL_LAND' | 'RENT_HOUSE' | 'RENT_LAND';
const POST_DRAFT_KEY = 'pendingPostDraft';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const draftRaw = useMemo(() => sessionStorage.getItem(POST_DRAFT_KEY), []);
  const hasPendingPostDraft = Boolean(draftRaw);
  const [autoPosting, setAutoPosting] = useState(false);
  const [autoPosted, setAutoPosted] = useState(false);

  const resolvePostTypeFromDraft = (draft: any): PostTypeApi | '' => {
    const d: Demand = draft?.demand || '';
    const propertyType: string = draft?.formData?.propertyType || '';
    if (!d) return '';
    const v = propertyType.toLowerCase();
    const isLand = v.includes('đất') || v.includes('dat');
    if (d === 'SELL') return isLand ? 'SELL_LAND' : 'SELL_HOUSE';
    return isLand ? 'RENT_LAND' : 'RENT_HOUSE';
  };

  useEffect(() => {
    fetchPaymentDetails();
  }, []);

  useEffect(() => {
    if (!draftRaw) return;
    if (autoPosted || autoPosting) return;

    let draft: any = null;
    try {
      draft = JSON.parse(draftRaw);
    } catch {
      sessionStorage.removeItem(POST_DRAFT_KEY);
      return;
    }

    const postType = resolvePostTypeFromDraft(draft);
    const fd = draft?.formData || {};
    const desc = String(draft?.description || '');

    // Chỉ auto gửi khi dữ liệu đủ tối thiểu
    if (!postType || !fd?.title || !desc) return;

    const submitData = new FormData();
    submitData.append('postType', postType);
    submitData.append('title', String(fd.title));
    submitData.append('description', desc);
    if (fd.city) submitData.append('city', String(fd.city));
    if (fd.district) submitData.append('district', String(fd.district));
    if (fd.ward) submitData.append('ward', String(fd.ward));
    if (fd.address) submitData.append('address', String(fd.address));
    if (fd.contactPhone) submitData.append('contactPhone', String(fd.contactPhone));
    if (fd.contactLink) submitData.append('contactLink', String(fd.contactLink));
    if (fd.price) submitData.append('price', String(fd.price));
    if (fd.area) submitData.append('area', String(fd.area));
    if (fd.direction) submitData.append('direction', String(fd.direction));

    // House/Land optional fields
    if (fd.bedrooms) submitData.append('bedrooms', String(fd.bedrooms));
    if (fd.bathrooms) submitData.append('bathrooms', String(fd.bathrooms));
    if (fd.floors) submitData.append('floors', String(fd.floors));
    if (fd.frontWidth) submitData.append('frontWidth', String(fd.frontWidth));
    if (fd.landLength) submitData.append('landLength', String(fd.landLength));
    if (fd.landType) submitData.append('landType', String(fd.landType));
    if (fd.legalStatus) submitData.append('legalStatus', String(fd.legalStatus));

    (async () => {
      try {
        setAutoPosting(true);
        await postApi.create(submitData);
        setAutoPosted(true);
        sessionStorage.removeItem(POST_DRAFT_KEY);
        message.success('✅ Đã tự động gửi bài đăng lên hệ thống (chờ Admin duyệt).');
      } catch (e: any) {
        const errMsg = e?.response?.data?.message || 'Không thể tự động gửi bài đăng.';
        message.error(`❌ ${Array.isArray(errMsg) ? errMsg[0] : errMsg}`);
      } finally {
        setAutoPosting(false);
      }
    })();
  }, [draftRaw, autoPosted, autoPosting]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      
      // Get the last payment ID from sessionStorage or localStorage
      const lastPaymentId = sessionStorage.getItem('lastPaymentId') || localStorage.getItem('lastPaymentId');
      
      if (!lastPaymentId) {
        // Try to get from user's payment list
        const res = await paymentApi.getMyPayments({ limit: 1 });
        const payments = res.data?.data || [];
        
        if (payments.length === 0) {
          setError(true);
          message.warning('Không tìm thấy thông tin thanh toán');
          return;
        }
        
        setPaymentData(payments[0]);
        localStorage.removeItem('lastPaymentId');
      } else {
        // Fetch specific payment
        const res = await paymentApi.getPaymentById(parseInt(lastPaymentId));
        setPaymentData(res.data?.data);
        sessionStorage.removeItem('lastPaymentId');
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
      setError(true);
      message.error('❌ Không thể tải thông tin thanh toán');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin description="Đang tải thông tin..." />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="500"
        title="Lỗi"
        subTitle="Không thể tải thông tin thanh toán. Vui lòng thử lại sau."
        extra={[
          <Button type="primary" onClick={() => navigate('/')}>
            Về trang chủ
          </Button>,
          <Button onClick={() => navigate(-1)}>
            Quay lại
          </Button>,
        ]}
      />
    );
  }

  const endDate = paymentData?.subscription?.endDate
    ? new Date(paymentData.subscription.endDate).toLocaleDateString('vi-VN')
    : 'N/A';
  const benefitLines = parseVipPackageBenefitLines(paymentData?.subscription?.package?.features);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Success Result */}
        <Result
          status="success"
          title="Thanh toán thành công!"
          subTitle="Tài khoản VIP của bạn đã được kích hoạt. Bạn có thể bắt đầu tận hưởng các quyền lợi VIP ngay bây giờ."
          extra={[
            hasPendingPostDraft && (
              <Button type="primary" size="large" loading={autoPosting} onClick={() => navigate('/posts/new?resumeDraft=1')}>
                {autoPosted ? 'Xem lại bài đăng' : 'Quay lại bài đăng'}
              </Button>
            ),
            <Button type="primary" size="large" onClick={() => navigate('/')}>
              Về trang chủ
            </Button>,
            <Button size="large" onClick={() => navigate('/profile')}>
              Xem hồ sơ
            </Button>,
          ].filter(Boolean)}
        />

        {/* Payment Details Card */}
        {paymentData && (
          <Card style={{ marginTop: 30, borderRadius: 12 }}>
            <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 'bold' }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              Chi tiết thanh toán
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <Statistic
                title="Gói VIP"
                value={paymentData.subscription?.package?.name || 'N/A'}
                prefix={<GiftOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: 16 }}
              />
              <Statistic
                title="Thời hạn"
                value={`${paymentData.subscription?.package?.durationDays || 0} ngày`}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#faad14', fontSize: 16 }}
              />
              <Statistic
                title="Ngày hết hạn"
                value={endDate}
                valueStyle={{ color: '#666', fontSize: 14 }}
              />
              <Statistic
                title="Số tiền"
                value={paymentData.amount || 0}
                suffix="VND"
                valueStyle={{ color: '#52c41a', fontSize: 16 }}
              />
            </div>

            {/* Features */}
            {benefitLines.length > 0 && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Quyền lợi VIP bao gồm:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {benefitLines.map((feature, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8 }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2 }} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Info */}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Thông tin giao dịch</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
                <div>
                  <p style={{ color: '#999', marginBottom: 4 }}>Mã thanh toán</p>
                  <p style={{ fontWeight: 'bold' }}>{paymentData.id}</p>
                </div>
                <div>
                  <p style={{ color: '#999', marginBottom: 4 }}>Mã giao dịch</p>
                  <p style={{ fontWeight: 'bold' }}>{paymentData.transactionId || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ color: '#999', marginBottom: 4 }}>Phương thức thanh toán</p>
                  <p style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{paymentData.paymentMethod}</p>
                </div>
                <div>
                  <p style={{ color: '#999', marginBottom: 4 }}>Trạng thái</p>
                  <p style={{ fontWeight: 'bold', color: '#52c41a' }}>Đã thanh toán</p>
                </div>
                <div>
                  <p style={{ color: '#999', marginBottom: 4 }}>Ngày thanh toán</p>
                  <p style={{ fontWeight: 'bold' }}>
                    {paymentData.paidAt
                      ? new Date(paymentData.paidAt).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Next Steps */}
        <Card style={{ marginTop: 24, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
          <h3>📋 Bước tiếp theo:</h3>
          <ol style={{ marginLeft: 20, marginBottom: 0 }}>
            <li style={{ marginBottom: 8 }}>
              Kiểm tra email của bạn để nhận thông tin chi tiết về gói VIP
            </li>
            <li style={{ marginBottom: 8 }}>
              Truy cập lại trang đăng bài để tận hưởng các ưu đãi VIP
            </li>
            <li style={{ marginBottom: 8 }}>
              Liên hệ support nếu bạn gặp bất kỳ vấn đề nào
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
