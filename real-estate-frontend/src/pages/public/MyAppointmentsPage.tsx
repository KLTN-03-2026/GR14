// src/pages/public/MyAppointmentsPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { appointmentApi } from '@/api';
import { depositApi } from '@/api/deposit';
import DepositFormSection from '@/components/common/DepositFormSection';
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

// ─── Shared label style ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  margin: '0 0 3px',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#94a3b8',
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

const MOCK_REFUND_HISTORY = [
  { id: 'REQ-001', date: '12/10/2023', property: 'Đất – Quận Ngũ Hành Sơn', status: 'refunded' as const },
  { id: 'REQ-002', date: '05/11/2023', property: 'Căn hộ – Quận Sơn Trà', status: 'processing' as const },
  { id: 'REQ-003', date: '20/11/2023', property: 'Nhà phố – Quận Hải Châu', status: 'rejected' as const },
];

const REFUND_STATUS_CFG = {
  refunded:   { label: 'Đã hoàn tiền', bg: '#dcfce7', color: '#16a34a' },
  processing: { label: 'Đang xử lý',   bg: '#fef9c3', color: '#ca8a04' },
  rejected:   { label: 'Từ chối',      bg: '#fee2e2', color: '#dc2626' },
};

const RefundModal: React.FC<RefundModalProps> = ({ deposit, onClose, onSuccess }) => {
  const [accountInfo, setAccountInfo] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const isBeforeVisit =
    deposit.appointment?.actualStatus === null ||
    deposit.appointment?.actualStatus === undefined;
  const refundPct = isBeforeVisit ? 95 : 50;
  const estimatedRefund = Math.round((Number(deposit.amount) * refundPct) / 100);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
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
      await depositApi.requestRefund(deposit.id, payload);
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
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.72)' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes refundSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinLoader {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 20,
          border: '0.5px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'refundSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '20px 24px 18px',
            borderBottom: '0.5px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#A32D2D',
                background: '#fee2e2',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              Hoàn tiền
            </span>
            <p style={{ margin: '10px 0 0', fontSize: 17, fontWeight: 500, color: '#0f172a', lineHeight: 1.3 }}>
              Yêu cầu hoàn tiền đặt cọc
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Vui lòng điền thông tin để chúng tôi xử lý yêu cầu của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '0.5px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 260px' }}>

          {/* Left: form */}
          <div
            style={{
              padding: '20px 20px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              borderRight: '0.5px solid #e2e8f0',
            }}
          >
            {/* Amount summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                border: '0.5px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 16px',
              }}
            >
              <div>
                <p style={labelStyle}>Số tiền cọc</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#0f172a' }}>
                  {fmtAmount(deposit.amount)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={labelStyle}>Dự kiến hoàn</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#16a34a' }}>
                  {fmtAmount(estimatedRefund)}
                </p>
              </div>
            </div>

            {/* Account input */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                Các khoản cọc khả dụng
              </label>
              <input
                type="text"
                value={accountInfo}
                onChange={(e) => setAccountInfo(e.target.value)}
                placeholder="VD: Vietcombank – 0123456789 – Nguyễn Văn A"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#0f172a',
                  background: '#f8fafc',
                  border: '0.5px solid #e2e8f0',
                  borderRadius: 10,
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#94a3b8')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
            </div>

            {/* Reason */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                Lý do hoàn tiền
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do chi tiết..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#0f172a',
                  background: '#f8fafc',
                  border: '0.5px solid #e2e8f0',
                  borderRadius: 10,
                  outline: 'none',
                  resize: 'none',
                  transition: 'border-color 0.15s',
                  lineHeight: 1.6,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#94a3b8')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !accountInfo.trim()}
              style={{
                width: '100%',
                padding: '10px 20px',
                borderRadius: 100,
                border: 'none',
                background: loading || !accountInfo.trim() ? '#e2e8f0' : '#2563eb',
                color: loading || !accountInfo.trim() ? '#94a3b8' : '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: loading || !accountInfo.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s',
              }}
            >
              {loading ? (
                <>
                  <svg
                    style={{ animation: 'spinLoader 1s linear infinite' }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Đang gửi...
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7z" />
                  </svg>
                  Gửi yêu cầu hoàn tiền
                </>
              )}
            </button>
          </div>

          {/* Right: policy + estimate + history */}
          <div
            style={{
              padding: 20,
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Refund policy */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                <p style={labelStyle}>Chính sách hoàn tiền</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { color: '#3B6D11', label: 'Hủy trước khi xem', value: '95%' },
                  { color: '#854F0B', label: 'Hủy sau khi đã xem', value: '50%' },
                  { color: '#A32D2D', label: 'Đã gặp & hoàn tất', value: '0%' },
                ].map(({ color, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated refund */}
            <div
              style={{
                borderRadius: 10,
                padding: '12px 14px',
                background: '#eff6ff',
                border: '0.5px solid #bfdbfe',
                textAlign: 'center',
              }}
            >
              <p style={{ ...labelStyle, color: '#93c5fd', marginBottom: 4 }}>Hoàn lại ước tính</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#1d4ed8', letterSpacing: '-0.01em' }}>
                {fmtAmount(estimatedRefund)}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#60a5fa' }}>({refundPct}% số tiền cọc)</p>
            </div>

            {/* Refund history */}
            <div>
              <p style={{ ...labelStyle, marginBottom: 8 }}>Lịch sử yêu cầu</p>
              <div style={{ border: '0.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    padding: '7px 12px',
                    borderBottom: '0.5px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Khoản cọc
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Trạng thái
                  </span>
                </div>
                {MOCK_REFUND_HISTORY.map((row, i) => {
                  const cfg = REFUND_STATUS_CFG[row.status];
                  return (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'center',
                        padding: '9px 12px',
                        borderBottom: i < MOCK_REFUND_HISTORY.length - 1 ? '0.5px solid #f1f5f9' : 'none',
                        gap: 8,
                      }}
                    >
                      <div>
                        <p style={{
                          margin: 0, fontSize: 11, fontWeight: 500, color: '#334155',
                          lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: 130,
                        }}>
                          {row.property}
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: 10, color: '#94a3b8' }}>{row.date}</p>
                      </div>
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 500,
                        padding: '3px 8px', borderRadius: 20,
                        background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
  const navigate = useNavigate();
  const property = appointment.house || appointment.land;
  const thumb = property?.images?.[0]?.url;
  const apptStatus = APPOINTMENT_STATUS_CFG[appointment.status] ?? APPOINTMENT_STATUS_CFG[0];

  const isApproved = appointment.status === 1;
  const isCompleted = appointment.actualStatus !== null;
  const hasActiveDeposit = deposit && (deposit.status === 0 || deposit.status === 1);
  const canDeposit = (isApproved || isCompleted) && !hasActiveDeposit;
  const canRefund = deposit?.status === 1 && appointment.actualStatus !== 1;

  const handleViewDetail = () => {
    if (appointment.houseId) navigate(`/houses/${appointment.houseId}`);
    else if (appointment.landId) navigate(`/lands/${appointment.landId}`);
  };

  // ── Fix: dùng button + window.location thay vì <a> để tránh lỗi TS ──
  const handlePayment = () => {
    const url = deposit?.payment?.paymentUrl;
    if (url) window.location.href = url;
  };

  return (
    <div className="group relative flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${apptStatus.bg} ${apptStatus.text} ${apptStatus.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${apptStatus.dot}`} />
            {apptStatus.label}
          </span>
          {deposit && <DepositBadge status={deposit.status} />}
          {isCompleted && !hasActiveDeposit && (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              Đã đi xem
            </span>
          )}
        </div>

        <p
          className="truncate text-sm font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={handleViewDetail}
        >
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
            <span>
              💰 Đã cọc:{' '}
              <strong className="text-gray-700">{fmtAmount(deposit.amount)}</strong>
            </span>
            {deposit.expiresAt && (
              <span>
                ⏰ Hết hạn:{' '}
                <strong className="text-gray-700">{fmtDate(deposit.expiresAt)}</strong>
              </span>
            )}
          </div>
        )}

        {appointment.status === 2 && appointment.cancelReason && (
          <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
            Lý do từ chối: {appointment.cancelReason}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-end justify-end gap-2 self-stretch">
        {/* Đặt cọc */}
        {canDeposit && (
          <button
            type="button"
            onClick={onDeposit}
            className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#f97316,#ea6c0a)',
              boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
              <path d="M16 12h6v4h-6a2 2 0 0 1 0-4z" />
            </svg>
            Đặt cọc
          </button>
        )}

        {/* Thanh toán — button thay vì <a> */}
        {deposit?.status === 0 && deposit.payment?.paymentUrl && (
          <button
            type="button"
            onClick={handlePayment}
            className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              boxShadow: '0 2px 8px rgba(245,158,11,0.35)',
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Thanh toán
          </button>
        )}

        {/* Hoàn tiền */}
        {canRefund && (
          <button
            type="button"
            onClick={onRefund}
            className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95"
            style={{ borderColor: '#ef4444', color: '#ef4444', background: '#fff5f5' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#ef4444';
              (e.currentTarget as HTMLElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#fff5f5';
              (e.currentTarget as HTMLElement).style.color = '#ef4444';
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
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
  const [statusFilter, setStatusFilter] = useState<number | 'all' | 'deposited'>('all');

  const [depositTarget, setDepositTarget] = useState<any | null>(null);
  const [refundTarget, setRefundTarget] = useState<Deposit | null>(null);

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
      deposits.forEach((d) => { map[d.appointmentId] = d; });
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
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAppointments, fetchDeposits]);

  const refresh = () => {
    void fetchAppointments();
    void fetchDeposits();
  };

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    if (statusFilter === 'deposited') return appointments.filter((a) => depositMap[a.id] && depositMap[a.id].status === 1);
    return appointments.filter((a) => a.status === (statusFilter as number));
  }, [appointments, statusFilter, depositMap]);

  const totalPage = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const counts = useMemo(() => ({
    all: appointments.length,
    pending: appointments.filter((a) => a.status === 0).length,
    approved: appointments.filter((a) => a.status === 1).length,
    rejected: appointments.filter((a) => a.status === 2).length,
    deposited: appointments.filter((a) => depositMap[a.id] && depositMap[a.id].status === 1).length,
  }), [appointments, depositMap]);

  

  return (
    <div className="min-h-screen bg-gray-50/70">
      <main className="mx-auto max-w-4xl px-4 py-10">

        {/* Page header */}
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

        {/* Info banner */}
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Sau khi lịch hẹn được duyệt, bạn có thể đặt cọc để giữ chỗ bất động sản.
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          {([
            { key: 'all' as const, label: 'Tất cả', count: counts.all },
            { key: 0, label: 'Chờ duyệt', count: counts.pending },
            { key: 1, label: 'Đã duyệt', count: counts.approved },
            { key: 2, label: 'Từ chối', count: counts.rejected },
            { key: 'deposited' as const, label: 'Đã cọc', count: counts.deposited },
          ]).map((tab) => {
            const active = statusFilter === tab.key;
            const dotCls =
              tab.key === 0 ? 'bg-amber-400'
              : tab.key === 1 ? 'bg-emerald-400'
              : tab.key === 2 ? 'bg-red-400'
              : tab.key === 'deposited' ? 'bg-blue-400'
              : 'bg-gray-300';
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

        {/* List */}
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

            {/* Pagination */}
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

      {/* Deposit Modal */}
      {depositTarget && (
        <DepositFormSection
          appointmentId={depositTarget.id}
          appointmentDate={depositTarget.appointmentDate}
          propertyTitle={
            depositTarget.house?.title ||
            depositTarget.land?.title ||
            'Bất động sản'
          }
          propertyPrice={depositTarget.house?.price || depositTarget.land?.price}
          propertyImage={
            depositTarget.house?.images?.[0]?.url || depositTarget.land?.images?.[0]?.url || undefined
          }
          onClose={() => setDepositTarget(null)}
          onSuccess={() => {
            setDepositTarget(null);
            refresh();
          }}
        />
      )}

      {/* Refund Modal */}
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