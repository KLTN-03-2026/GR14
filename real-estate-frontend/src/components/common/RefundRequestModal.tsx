import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { depositApi } from '@/api/deposit';

interface RefundRequestModalProps {
  depositId: number;
  amount?: number;
  propertyTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const formatAmount = (value?: number) => {
  if (!value) return '—';
  return `${Number(value).toLocaleString('vi-VN')} đ`;
};

const RefundRequestModal = ({
  depositId,
  amount,
  propertyTitle,
  onClose,
  onSuccess,
}: RefundRequestModalProps) => {
  const [accountInfo, setAccountInfo] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSubmit = async () => {
    if (!accountInfo.trim()) {
      toast.error('Vui lòng nhập thông tin tài khoản nhận hoàn tiền');
      return;
    }

    setLoading(true);
    try {
      const payload = reason.trim()
        ? `${accountInfo.trim()} | Lý do: ${reason.trim()}`
        : accountInfo.trim();

      await depositApi.requestRefund(depositId, payload);
      toast.success('Gửi yêu cầu hoàn tiền thành công!');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Gửi yêu cầu hoàn tiền thất bại. Vui lòng thử lại.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.72)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ border: '0.5px solid #e2e8f0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
          <div>
            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              Hoàn tiền
            </span>
            <p className="mt-2 text-[17px] font-semibold text-slate-900">Yêu cầu hoàn tiền đặt cọc</p>
            {propertyTitle ? <p className="mt-1 text-sm text-slate-500">{propertyTitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full"
            style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Số tiền cọc</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatAmount(amount)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Thông tin tài khoản nhận hoàn</label>
            <input
              type="text"
              value={accountInfo}
              onChange={(e) => setAccountInfo(e.target.value)}
              placeholder="VD: Vietcombank - 0123456789 - Nguyễn Văn A"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ border: '0.5px solid #e2e8f0', background: '#fff' }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lý do hoàn tiền</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do..."
              className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ border: '0.5px solid #e2e8f0', background: '#fff' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '0.5px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600"
            style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc' }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !accountInfo.trim()}
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={
              loading || !accountInfo.trim()
                ? { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }
                : { background: '#ef4444' }
            }
          >
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu hoàn tiền'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundRequestModal;
