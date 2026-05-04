import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { depositApi } from '@/api/deposit';
import DepositCreatedModal from './DepositCreatedModal';

interface DepositFormSectionProps {
  appointmentId: number;
  appointmentDate?: string;
  isAfterViewing?: boolean;
  propertyTitle: string;
  propertyPrice?: number;
  propertyImage?: string;
  onClose: () => void;
  onSuccess?: () => void;
  disabled?: boolean;
}

const DepositFormSection = ({
  appointmentId,
  appointmentDate,
  isAfterViewing = false,
  propertyTitle,
  propertyPrice: propertyPriceProp,
  propertyImage,
  onClose,
  onSuccess,
  disabled,
}: DepositFormSectionProps) => {
  const [amount, setAmount] = useState('10000000');
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | ''>('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; paymentUrl: string; depositId: number | null; amount: number | null }>({ open: false, paymentUrl: '', depositId: null, amount: null });

  const numericAmount = Number(amount.replace(/[^0-9]/g, ''));
  const propertyPrice = propertyPriceProp ? Number(propertyPriceProp) : 0;

  const depositMode = 'Giữ chỗ trước khi xem';
  const depositDescription = 'Đặt cọc trước ng� y hẹn xem. Có thể ho� n tiền theo điều kiện.';

  const amountBounds = useMemo(() => {
    // Single exact suggestion: 0.2% of property price (rounded), with minimum 1.000.000 đ
    const suggested = propertyPrice > 0 ? Math.max(1_000_000, Math.round(propertyPrice * 0.002)) : 1_000_000;
    return {
      min: suggested,
      max: suggested,
      suggested,
      label: `Gợi ý: ${new Intl.NumberFormat('vi-VN').format(suggested)} đ (0.2% giá BĐS)`,
    };
  }, [propertyPrice]);

  const amountIsValid = numericAmount === (amountBounds as any).suggested;
  const canSubmit = !loading && !disabled && agreed && amountIsValid && paymentMethod !== '';

  const paymentSuggestions = useMemo(() => {
    return [amountBounds.suggested];
  }, [amountBounds]);

  useEffect(() => {
    // Always set the amount to the single suggested value
    setAmount(String(amountBounds.suggested || amountBounds.min));
  }, [amountBounds]);

  const handleSuggestion = (value: number) => {
    setAmount(String(value));
  };

  const handleSubmit = async () => {
    if (disabled) {
      toast.error('Bạn cần có lịch hẹn đã duyệt để đặt cọc.');
      return;
    }
    if (!agreed) {
      toast.error('Vui lòng đồng ý với chính sách đặt cọc trước khi tiếp tục.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Vui lòng nhập số tiền đặt cọc hợp lệ.');
      return;
    }
    if (!amountIsValid) {
      toast.error(`Số tiền cần nằm trong khoảng ${amountBounds.label}.`);
      return;
    }
    if (!paymentMethod) {
      toast.error('Vui lòng chọn phương thức thanh toán.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        appointmentId,
        amount: numericAmount,
        paymentMethod,
        returnUrl:
          paymentMethod === 'momo'
            ? `${import.meta.env.VITE_API_URL}/payment/momo/callback`
            : `${window.location.origin}/payment/vnpay-callback`,
      };

      const res = await depositApi.createDeposit(payload);
      const responseData: any = res.data?.data || res.data || {};
      const paymentUrl =
        responseData.paymentUrl ||
        responseData.url ||
        responseData.redirectUrl ||
        responseData.payment?.paymentUrl;
      const depositId =
        responseData.depositId ||
        responseData.id ||
        responseData.deposit?.id ||
        responseData.payment?.depositId ||
        responseData.paymentId;

      if (paymentUrl) {
        // show nicer confirmation modal with payment action
        setPaymentModal({
          open: true,
          paymentUrl,
          depositId: depositId || null,
          amount: numericAmount,
        });
        return;
      }

      toast.success('Yêu cầu đặt cọc đã được tạo. Bạn có thể thanh toán sau.');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Tạo yêu cầu đặt cọc thất bại. Vui lòng thử lại.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const formattedAmount =
    numericAmount > 0
      ? new Intl.NumberFormat('vi-VN').format(numericAmount) + ' đ'
      : '—';

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-[1400] flex items-start justify-center overflow-y-auto px-2 py-6 sm:items-center sm:px-3 sm:py-6"
      style={{ background: 'rgba(15,23,42,0.75)' }}
      onClick={onClose}
    >
      {/* ── Modal shell ── */}
      <div
        className="relative mx-auto w-full max-w-[600px] overflow-hidden bg-white shadow-xl"
        style={{
          borderRadius: 20,
          border: '0.5px solid #e2e8f0',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'depositSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes depositSlideUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '0.5px solid #e2e8f0', flexShrink: 0 }}
        >
          <div>
            <span
              className="inline-block text-[10px] font-medium tracking-widest uppercase mb-1.5 px-2.5 py-0.5 rounded-full"
              style={{ background: '#fff7ed', color: '#f97316', border: '0.5px solid #fed7aa' }}
            >
              {depositMode}
            </span>
            <h3 className="text-[17px] font-medium text-slate-900">Ho� n tất đặt cọc bất động sản</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', color: '#64748b' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0, maxHeight: 'calc(100vh - 190px)' }}>

          {/* Bug #5: Cảnh báo cọc chốt mua không ho� n tiền */}
          {isAfterViewing && (
            <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: '#fef3c7', border: '0.5px solid #f59e0b' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706"
                strokeWidth="2.2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-[11px] leading-snug" style={{ color: '#92400e' }}>
                <strong>Cọc chốt mua sau khi xem.</strong> Bạn đã đến xem bất động sản n� y. Số tiền cọc lần n� y� <strong>không được ho� n trả</strong>� nếu bạn hủy.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ minHeight: 0 }}>

            {/* ── Left panel: policy info ── */}
            <div className="flex flex-col gap-3 p-4 sm:border-r sm:border-slate-200">

              {/* Property + date — single unified card */}
              <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}>
                <div className="flex items-start gap-2.5">
                  {propertyImage && (
                    <img src={propertyImage} alt={propertyTitle} className="w-14 h-10 object-cover rounded-md flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Bất động sản</p>
                    <p className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2">{propertyTitle}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid #e2e8f0' }}>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Lịch hẹn đã duyệt</p>
                  <p className="text-[12px] font-medium text-slate-700">{appointmentDate ? new Date(appointmentDate).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-2">Loại đặt cọc</p>
                <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}>
                  <p className="text-[12px] font-semibold text-slate-900 mb-1">{depositMode}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{depositDescription}</p>
                  <p className="text-[11px] text-slate-500 mt-3">{propertyPrice > 0 ? `Khoảng ${amountBounds.label}` : 'Tối thiểu 1.000.000 đ, giới hạn cọc sẽ được xác định theo giá trị BĐS.'}</p>
                </div>
              </div>

              {/* Refund policy */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Chính sách ho� n tiền</p>
                </div>
                <div className="flex flex-col gap-1">
                  {[
                    { label: 'Hủy trước ng� y hẹn xem', pct: '95%', color: '#16a34a' },
                    { label: 'Hủy sau hẹn (chưa xem)', pct: '50%', color: '#f97316' },
                    { label: 'Sau khi xem bất động sản', pct: '0%', color: '#dc2626' },
                  ].map(({ label, pct, color }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center rounded-xl px-3 py-2 text-[11px]"
                      style={{ background: '#f8fafc' }}
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium" style={{ color }}>{pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right panel: form ── */}
            <div className="flex flex-col gap-4 p-4">

              {/* Amount */}
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-2">Số tiền đặt cọc</label>
                <div className="flex flex-col gap-1.5 mb-2">
                  {paymentSuggestions.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSuggestion(val)}
                      className="rounded-lg text-[12px] font-medium py-2.5 px-3 transition-all"
                      style={
                        numericAmount === val
                          ? { background: '#fff7ed', border: '0.5px solid #f97316', color: '#f97316' }
                          : { background: '#f8fafc', border: '0.5px solid #e2e8f0', color: '#64748b' }
                      }
                    >
                      💡 Gợi ý: {new Intl.NumberFormat('vi-VN').format(val)} đ
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={numericAmount > 0 ? new Intl.NumberFormat('vi-VN').format(numericAmount) + ' đ' : ''}
                  readOnly
                  inputMode="numeric"
                  className="w-full rounded-xl px-4 py-2.5 text-lg font-semibold text-slate-900 outline-none transition-all bg-white"
                  style={{ border: '0.5px solid #e2e8f0' }}
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                  {amountBounds.label}
                </p>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-2">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['vnpay', 'momo'] as const).map((method) => {
                    const selected = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className="rounded-xl p-3 text-left transition-all"
                        style={
                          selected
                            ? { border: '0.5px solid #f97316', background: '#fff7ed' }
                            : { border: '0.5px solid #e2e8f0', background: '#fff' }
                        }
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold mb-2"
                          style={{ background: method === 'vnpay' ? '#003b8a' : '#a0025c' }}
                        >
                          {method === 'vnpay' ? 'V' : 'M'}
                        </div>
                        <div className="text-[12px] font-medium text-slate-800 mb-0.5">
                          {method === 'vnpay' ? 'VNPay' : 'MoMo'}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-snug">
                          Thanh toán qua cổng {method === 'vnpay' ? 'VNPay' : 'MoMo'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: '#f8fafc' }}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fff7ed' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-slate-800 mb-0.5">Bảo mật thanh toán</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Bạn sẽ được chuyển tới cổng thanh toán chính thức để ho� n tất yêu cầu đặt cọc an to� n.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '0.5px solid #e2e8f0', flexShrink: 0, padding: '12px 20px 16px' }}>
          {/* Agreement — luôn hiển thị, không bị cuộn mất */}
          <button
            type="button"
            onClick={() => setAgreed((v) => !v)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 w-full text-left transition-all mb-3"
            style={
              agreed
                ? { background: '#fff7ed', border: '0.5px solid #f97316' }
                : { background: '#f8fafc', border: '0.5px solid #e2e8f0' }
            }
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
              style={
                agreed
                  ? { background: '#f97316', border: '1.5px solid #f97316' }
                  : { background: '#fff', border: '1.5px solid #cbd5e1' }
              }
            >
              {agreed && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
            <span className="text-[11px] leading-snug" style={{ color: agreed ? '#c2410c' : '#64748b' }}>
              Tôi đã đọc, hiểu rõ v�  <strong>đồng ý</strong> với chính sách đặt cọc bất động sản trên đây.
            </span>
          </button>

          {/* Hint: điều kiện còn thiếu */}
          {!canSubmit && (
            <p className="text-[11px] text-amber-600 mb-2 text-center">
              {!paymentMethod
                ? '�  Vui lòng chọn phương thức thanh toán'
                : !agreed
                ? '�  Vui lòng tích chọn đồng ý chính sách ở trên'
                : ''}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate-400">
              Số tiền:{' '}
              <span className="font-medium" style={{ color: '#f97316' }}>{formattedAmount}</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-[13px] text-slate-500 transition-colors"
                style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-medium text-white transition-all"
                style={
                  canSubmit
                    ? { background: '#f97316' }
                    : { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }
                }
              >
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Đồng ý & Thanh toán
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Deposit created confirmation modal */}
      <DepositCreatedModal
        visible={paymentModal.open}
        depositId={paymentModal.depositId}
        amount={paymentModal.amount}
        propertyTitle={propertyTitle}
        propertyImage={propertyImage}
        onClose={() => {
          setPaymentModal({ open: false, paymentUrl: '', depositId: null, amount: null });
          onSuccess?.();
          onClose();
        }}
        onPayNow={() => {
          if (paymentModal.depositId) sessionStorage.setItem('lastDepositId', String(paymentModal.depositId));
          window.location.href = paymentModal.paymentUrl || '';
        }}
      />
    </div>
  );
};

export default DepositFormSection;