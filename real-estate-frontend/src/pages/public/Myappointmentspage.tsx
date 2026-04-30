// src/pages/public/MyAppointmentsPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { appointmentApi } from '@/api';
import { depositApi } from '@/api/deposit';
import {
  DEPOSIT_STATUS_CFG,
  APPOINTMENT_STATUS_CFG,
  type Deposit,
  type DepositStatus,
} from '@/types/deposit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmount = (val: string | number | null | undefined) => {
  if (!val) return '—';
  return Number(val).toLocaleString('vi-VN') + ' ₫';
};

const fmtDate = (val: string | null | undefined) => {
  if (!val) return '—';
  return dayjs(val).format('DD/MM/YYYY HH:mm');
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="animate-pulse space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
    <div className="flex gap-4">
      <div className="h-20 w-28 shrink-0 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-gray-200" />
          <div className="h-5 w-24 rounded-full bg-gray-200" />
        </div>
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onBook }: { onBook: () => void }) => (
  <div className="flex flex-col items-center gap-4 py-20 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    </div>
    <div>
      <p className="font-semibold text-gray-700">Bạn chưa có lịch hẹn nào</p>
      <p className="mt-1 text-sm text-gray-400">Đặt lịch để xem bất động sản bạn quan tâm!</p>
    </div>
    <button
      onClick={onBook}
      className="mt-1 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Đặt lịch ngay
    </button>
  </div>
);

// ─── Deposit Badge ─────────────────────────────────────────────────────────────

const DepositBadge = ({ status }: { status: DepositStatus }) => {
  const cfg = DEPOSIT_STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Refund Modal ─────────────────────────────────────────────────────────────

interface RefundModalProps {
  deposit: Deposit;
  onClose: () => void;
  onSuccess: () => void;
}

const RefundModal: React.FC<RefundModalProps> = ({ deposit, onClose, onSuccess }) => {
  const [accountInfo, setAccountInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const isBeforeAppointment = dayjs().isBefore(dayjs(deposit.appointment.appointmentDate));
  const refundPct = isBeforeAppointment ? 95 : 100;
  const estimatedRefund = (Number(deposit.amount) * refundPct) / 100;

  const handleSubmit = async () => {
    if (!accountInfo.trim()) {
      toast.error('Vui lòng nhập thông tin tài khoản nhận hoàn tiền');
      return;
    }
    setLoading(true);
    try {
      await depositApi.requestRefund(deposit.id, accountInfo.trim());
      toast.success('Gửi yêu cầu hoàn tiền thành công!');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gửi yêu cầu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Yêu cầu hoàn tiền</h3>
            <p className="text-xs text-gray-500">Số tiền cọc: {fmtAmount(deposit.amount)}</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-800">
          <p className="font-semibold">Chính sách hoàn tiền:</p>
          <p className="mt-1">
            {isBeforeAppointment
              ? `Hủy trước ngày hẹn → hoàn ${refundPct}% (~${fmtAmount(estimatedRefund)})`
              : `Đã đi xem không ưng ý → hoàn ${refundPct}% (~${fmtAmount(estimatedRefund)})`}
          </p>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Thông tin tài khoản nhận hoàn tiền <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={accountInfo}
            onChange={(e) => setAccountInfo(e.target.value)}
            placeholder="VD: Vietcombank - 0123456789 - Nguyễn Văn A"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition resize-none"
          />
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !accountInfo.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Gửi yêu cầu
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Deposit Modal ────────────────────────────────────────────────────────────

interface DepositModalProps {
  appointmentId: number;
  appointmentDate: string;
  propertyTitle: string;
  isAfterViewing: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({
  appointmentId,
  appointmentDate,
  propertyTitle,
  isAfterViewing,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'payment'>('amount');
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo' | null>(null);

  const suggestions = [10_000_000, 20_000_000, 50_000_000, 100_000_000];

  const handleNextStep = () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Vui lòng nhập số tiền cọc hợp lệ');
      return;
    }
    setStep('payment');
  };

  const handleDeposit = async () => {
    if (!paymentMethod) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Số tiền cọc phải lớn hơn 0');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        appointmentId,
        amount: numAmount,
        paymentMethod,
        // ✅ Giống VIP: dùng /payment/vnpay-callback cho VNPay
        //               dùng VITE_API_URL/payment/momo/callback cho MoMo (BE xử lý IPN)
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
        (responseData.payment && responseData.payment.paymentUrl);

      const depositId =
        responseData.depositId ||
        responseData.id ||
        (responseData.deposit && responseData.deposit.id) ||
        (responseData.payment && responseData.payment.depositId) ||
        responseData.paymentId;

      if (paymentUrl) {
        // ✅ Lưu depositId vào sessionStorage — VNPayCallbackPage sẽ đọc để biết đây là deposit
        if (depositId) {
          sessionStorage.setItem('lastDepositId', String(depositId));
        }
        window.location.href = paymentUrl;
      } else {
        toast.success('Tạo yêu cầu đặt cọc thành công!');
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Tạo yêu cầu thanh toán thất bại. Vui lòng thử lại!';
      toast.error(errorMessage);
      console.error('Deposit creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

        {step === 'amount' ? (
          <>
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isAfterViewing ? 'bg-purple-100' : 'bg-blue-100'}`}>
                <svg className={`h-5 w-5 ${isAfterViewing ? 'text-purple-600' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {isAfterViewing ? '🔒 Cọc chốt mua' : '📅 Giữ chỗ trước khi xem'}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-1">{propertyTitle}</p>
              </div>
            </div>

            {isAfterViewing ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                <p className="font-semibold">⚠️ Lưu ý quan trọng:</p>
                <p className="mt-1">Bạn đã đi xem bất động sản này. Nếu tiếp tục đặt cọc, đây được xem là <strong>cọc chốt mua</strong>. Tiền cọc sẽ <strong>KHÔNG ĐƯỢC HOÀN LẠI</strong> nếu bạn đổi ý không ký hợp đồng.</p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-800">
                <p className="font-semibold">Chính sách hoàn tiền:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• Hủy trước ngày hẹn → hoàn <strong>95%</strong></li>
                  <li>• Đi xem không ưng ý → hoàn <strong>100%</strong></li>
                </ul>
                <p className="mt-1.5 text-xs text-blue-600">Ngày hẹn: {fmtDate(appointmentDate)}</p>
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Số tiền cọc <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">₫</span>
              </div>
              {amount && Number(amount) > 0 && (
                <p className="mt-1 text-xs text-gray-500">{Number(amount).toLocaleString('vi-VN')} ₫</p>
              )}
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setAmount(String(s))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    amount === String(s)
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {(s / 1_000_000).toLocaleString('vi-VN')}tr
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2.5">
              <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Hủy
              </button>
              <button
                onClick={handleNextStep}
                disabled={!amount || Number(amount) <= 0}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition ${
                  isAfterViewing ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Tiếp theo →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Payment step */}
            <div className="mb-1 flex items-center gap-2">
              <button onClick={() => setStep('amount')} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-bold text-gray-900">👑 Xác nhận thanh toán</h3>
            </div>

            <div className="mb-5 mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Loại giao dịch</span>
                <span className="font-semibold text-blue-600">{isAfterViewing ? 'Cọc chốt mua' : 'Giữ chỗ xem nhà'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bất động sản</span>
                <span className="font-semibold text-gray-800 text-right max-w-[200px] truncate">{propertyTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ngày hẹn</span>
                <span className="font-semibold text-gray-800">{fmtDate(appointmentDate)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-gray-500">Tổng tiền cọc</span>
                <span className="text-lg font-bold text-orange-500">{Number(amount).toLocaleString('vi-VN')} ₫</span>
              </div>
            </div>

            <p className="mb-3 text-sm font-semibold text-gray-700">Phương thức thanh toán</p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('vnpay')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 transition ${
                  paymentMethod === 'vnpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <span className="text-lg font-black text-blue-600">VNPay</span>
                <span className="text-[10px] text-gray-400">ATM · QR · Visa · Master</span>
              </button>
              <button
                onClick={() => setPaymentMethod('momo')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 transition ${
                  paymentMethod === 'momo' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-300'
                }`}
              >
                <span className="text-lg font-black text-pink-500">MoMo</span>
                <span className="text-[10px] text-gray-400">Ví điện tử MoMo</span>
              </button>
            </div>

            <div className="flex justify-end gap-2.5">
              <button onClick={onClose} disabled={loading} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Hủy
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading || !paymentMethod}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                Thanh toán ngay
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Appointment Card ─────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appointment: any;
  deposit: Deposit | null;
  onDeposit: () => void;
  onRefund: () => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  deposit,
  onDeposit,
  onRefund,
}) => {
  const property = appointment.house || appointment.land;
  const thumb = property?.images?.[0]?.url;
  const apptStatus = APPOINTMENT_STATUS_CFG[appointment.status] ?? APPOINTMENT_STATUS_CFG[0];

  const isApproved = appointment.status === 1;
  const isCompleted = appointment.actualStatus !== null;
  const isAfterViewing = isCompleted;
  const hasActiveDeposit = deposit && (deposit.status === 0 || deposit.status === 1);
  const canDeposit = (isApproved || isCompleted) && !hasActiveDeposit;
  const canRefund = deposit?.status === 1 && deposit?.depositType === 'BEFORE_VIEWING';

  return (
    <div className="group relative flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${apptStatus.bg} ${apptStatus.text} ${apptStatus.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${apptStatus.dot}`} />
            {apptStatus.label}
          </span>
          {deposit && <DepositBadge status={deposit.status} />}
        </div>

        <p className="truncate text-sm font-semibold text-gray-800">
          {property?.title || `Bất động sản #${appointment.houseId || appointment.landId}`}
        </p>

        {(property?.district || property?.city) && (
          <p className="mt-0.5 text-xs text-gray-500">
            📍 {[property.district, property.city].filter(Boolean).join(', ')}
          </p>
        )}

        <p className="mt-1 text-xs text-gray-500">
          🗓 {fmtDate(appointment.appointmentDate)}
          {appointment.durationMinutes && ` · ${appointment.durationMinutes} phút`}
        </p>

        {deposit && deposit.status === 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>💰 Đã cọc: <strong className="text-gray-700">{fmtAmount(deposit.amount)}</strong></span>
            {deposit.expiresAt && (
              <span>⏰ Hết hạn: <strong className="text-gray-700">{fmtDate(deposit.expiresAt)}</strong></span>
            )}
          </div>
        )}

        {appointment.status === 2 && appointment.cancelReason && (
          <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
            Lý do từ chối: {appointment.cancelReason}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch">
        {canDeposit && (
          <button
            onClick={onDeposit}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition ${
              isAfterViewing ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isAfterViewing ? '🔒 Cọc chốt mua' : '💳 Đặt cọc ngay'}
          </button>
        )}

        {deposit?.status === 0 && deposit.payment?.paymentUrl && (
          <a
            href={deposit.payment.paymentUrl}
            className="whitespace-nowrap rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition"
          >
            ↗ Thanh toán
          </a>
        )}

        {canRefund && (
          <button
            onClick={onRefund}
            className="whitespace-nowrap rounded-xl border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition"
          >
            Hoàn tiền
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const MyAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [depositMap, setDepositMap] = useState<Record<number, Deposit>>({});
  const [page, setPage] = useState(1);

  const [depositTarget, setDepositTarget] = useState<any | null>(null);
  const [refundTarget, setRefundTarget] = useState<Deposit | null>(null);
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.getMyAppointments();
      const data: any[] = res.data?.data || res.data || [];
      setAppointments(data);
    } catch (err: any) {
      console.error('Status:', err?.response?.status);
      console.error('Message:', err?.response?.data?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeposits = useCallback(async () => {
    try {
      const res = await depositApi.getMyDeposits(1, 100);
      const deposits: Deposit[] = res.data?.data || [];
      const map: Record<number, Deposit> = {};
      deposits.forEach((d) => {
        map[d.appointmentId] = d;
      });
      setDepositMap(map);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchAppointments();
    void fetchDeposits();

    const interval = setInterval(() => {
      void fetchAppointments();
      void fetchDeposits();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAppointments, fetchDeposits]);

  const refresh = () => {
    void fetchAppointments();
    void fetchDeposits();
  };

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const totalPage = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const counts = useMemo(() => ({
    all: appointments.length,
    pending: appointments.filter((a) => a.status === 0).length,
    approved: appointments.filter((a) => a.status === 1).length,
    rejected: appointments.filter((a) => a.status === 2).length,
  }), [appointments]);

  return (
    <div className="min-h-screen bg-gray-50/70">
      <main className="mx-auto max-w-4xl px-4 py-10">

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Lịch hẹn của tôi</h1>
            <p className="mt-0.5 text-sm text-gray-400">{appointments.length} lịch hẹn</p>
          </div>
          <button
            onClick={() => navigate('/houses')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Đặt lịch mới
          </button>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Sau khi lịch hẹn được duyệt, bạn có thể đặt cọc để giữ chỗ bất động sản.
        </div>

        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          {([
            { key: 'all' as const, label: 'Tất cả', count: counts.all },
            { key: 0, label: 'Chờ duyệt', count: counts.pending },
            { key: 1, label: 'Đã duyệt', count: counts.approved },
            { key: 2, label: 'Từ chối', count: counts.rejected },
          ]).map((tab) => {
            const active = statusFilter === tab.key;
            const dotCls = tab.key === 0 ? 'bg-amber-400' : tab.key === 1 ? 'bg-emerald-400' : tab.key === 2 ? 'bg-red-400' : 'bg-gray-300';
            return (
              <button
                key={String(tab.key)}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.key !== 'all' && (
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : dotCls}`} />
                )}
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onBook={() => navigate('/houses')} />
        ) : (
          <>
            <div className="space-y-3">
              {paged.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  deposit={depositMap[appt.id] ?? null}
                  onDeposit={() => setDepositTarget(appt)}
                  onRefund={() => setRefundTarget(depositMap[appt.id] ?? null)}
                />
              ))}
            </div>

            {totalPage > 1 && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPage }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition ${
                      p === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPage, p + 1))}
                  disabled={page === totalPage}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Deposit Modal ──────────────────────────── */}
      {depositTarget && (
        <DepositModal
          appointmentId={depositTarget.id}
          appointmentDate={depositTarget.appointmentDate}
          propertyTitle={
            depositTarget.house?.title ||
            depositTarget.land?.title ||
            'Bất động sản'
          }
          isAfterViewing={depositTarget.actualStatus !== null}
          onClose={() => setDepositTarget(null)}
          onSuccess={refresh}
        />
      )}

      {/* ── Refund Modal ───────────────────────────── */}
      {refundTarget && (
        <RefundModal
          deposit={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
};

export default MyAppointmentsPage;