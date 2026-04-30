import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { depositApi } from '@/api/deposit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefundItem {
  id: number;
  amount: number;
  refundAmount: number | null;
  refundAccountInfo: string | null;
  depositType: 'BEFORE_VIEWING' | 'AFTER_VIEWING';
  status: number; // 2=chờ duyệt, 3=đã hoàn, 1=từ chối
  adminNote: string | null;
  refundedAt: string | null;
  updatedAt: string;
  createdAt: string;
  user: {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
  };
  appointment: {
    id: number;
    appointmentDate: string;
    actualStatus?: number | null; // 1 = đã gặp, 0 = chưa gặp
    house?: { id: number; title: string } | null;
    land?: { id: number; title: string } | null;
  };
  payment: {
    paymentMethod: string;
    transactionId: string;
  } | null;
}

interface Meta {
  total: number;
  page: number;
  lastPage: number;
  totalPending?: number;
  totalApproved?: number;
  totalRejected?: number;
}

// ─── Refund Logic ─────────────────────────────────────────────────────────────

/**
 * Tính số tiền được hoàn dựa theo quy tắc:
 *  - Chưa gặp nhân viên (actualStatus != 1) → hoàn 95%
 *  - Đã gặp nhân viên (actualStatus === 1)  → không hoàn (0đ)
 */
const calcRefund = (item: RefundItem): { amount: number; rate: number; reason: string } => {
  const met = item.appointment?.actualStatus === 1;
  if (met) {
    return {
      amount: 0,
      rate: 0,
      reason: 'Khách đã xem bất động sản cùng nhân viên — không hoàn tiền cọc.',
    };
  }
  return {
    amount: Math.round(item.amount * 0.95),
    rate: 95,
    reason: 'Khách chưa xem bất động sản — hoàn 95% tiền cọc.',
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmount = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '—';
  return dayjs(v).format('DD/MM/YYYY HH:mm');
};

const STATUS_CFG: Record<number, { label: string; bg: string; text: string; dot: string; border: string }> = {
  2: { label: 'Chờ duyệt', bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400', border: 'border-amber-200' },
  3: { label: 'Đã hoàn',   bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-400', border: 'border-green-200' },
  1: { label: 'Từ chối',   bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-400',   border: 'border-red-200'   },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 8 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 animate-pulse rounded bg-gray-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ─── Refund Policy Banner ─────────────────────────────────────────────────────

const RefundPolicyBanner: React.FC<{ item: RefundItem }> = ({ item }) => {
  const { amount, rate, reason } = calcRefund(item);
  const met = item.appointment?.actualStatus === 1;

  return (
    <div className={`mb-4 rounded-xl border p-3 ${
      met
        ? 'border-red-200 bg-red-50'
        : 'border-green-200 bg-green-50'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          met ? 'bg-red-100' : 'bg-green-100'
        }`}>
          {met ? (
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${met ? 'text-red-700' : 'text-green-700'}`}>
            {reason}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Tiền cọc gốc</p>
              <p className="text-sm font-bold text-gray-700">{fmtAmount(item.amount)}</p>
            </div>
            <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">
                Số tiền hoàn ({rate}%)
              </p>
              <p className={`text-sm font-extrabold ${met ? 'text-red-600' : 'text-green-600'}`}>
                {met ? 'Không hoàn' : fmtAmount(amount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  item: RefundItem;
  mode: 'detail' | 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

const RefundModal: React.FC<ModalProps> = ({ item, mode, onClose, onSuccess }) => {
  const [adminNote, setAdminNote] = useState(item.adminNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const property = item.appointment?.house || item.appointment?.land;
  const refund = calcRefund(item);
  const isAction = mode === 'approve' || mode === 'reject';

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await depositApi.adminProcessRefund(item.id, {
        approve: mode === 'approve',
        adminNote: adminNote.trim() || undefined,
      });
      toast.success(mode === 'approve' ? 'Đã xác nhận hoàn tiền' : 'Đã từ chối yêu cầu');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            mode === 'approve' ? 'bg-green-100' : mode === 'reject' ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            {mode === 'approve' && (
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {mode === 'reject' && (
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {mode === 'detail' && (
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">
              {mode === 'approve' ? 'Xác nhận hoàn tiền' : mode === 'reject' ? 'Từ chối hoàn tiền' : `Chi tiết yêu cầu #${item.id}`}
            </h3>
            <p className="text-xs text-gray-500">Lịch hẹn #{item.appointment?.id}</p>
          </div>
        </div>

        {/* Refund policy banner — chỉ hiện khi đang xử lý hoặc xem chi tiết chờ duyệt */}
        {(isAction || (mode === 'detail' && item.status === 2)) && (
          <RefundPolicyBanner item={item} />
        )}

        {/* Info grid */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Khách hàng</p>
            <p className="text-sm font-semibold text-gray-800">{item.user?.fullName}</p>
            <p className="text-xs text-gray-500">{item.user?.phone}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Loại cọc</p>
            <p className="text-sm text-gray-700">
              {item.depositType === 'BEFORE_VIEWING' ? 'Trước khi xem' : 'Cọc chốt mua'}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              Trạng thái lịch hẹn:{' '}
              <span className={item.appointment?.actualStatus === 1 ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                {item.appointment?.actualStatus === 1 ? 'Đã gặp' : 'Chưa gặp'}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Tiền cọc gốc</p>
            <p className="text-sm font-bold text-gray-800">{fmtAmount(item.amount)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Thanh toán qua</p>
            <p className="text-sm font-semibold text-gray-700 uppercase">
              {item.payment?.paymentMethod ?? '—'}
            </p>
          </div>
        </div>

        {/* Bất động sản */}
        <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Bất động sản</p>
          <p className="text-sm font-medium text-gray-800">{property?.title ?? '—'}</p>
          <p className="text-xs text-gray-500">Ngày hẹn: {fmtDate(item.appointment?.appointmentDate)}</p>
        </div>

        {/* Tài khoản nhận hoàn tiền */}
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Tài khoản nhận hoàn tiền</p>
          <p className="text-sm font-medium text-blue-800 break-all">{item.refundAccountInfo ?? '—'}</p>
        </div>

        {/* Admin note */}
        {isAction ? (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Ghi chú admin{' '}
              <span className="font-normal text-gray-400">(tuỳ chọn)</span>
            </label>
            <textarea
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={
                mode === 'approve'
                  ? 'Mã giao dịch chuyển khoản, ngân hàng...'
                  : 'Lý do từ chối...'
              }
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        ) : item.adminNote ? (
          <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Ghi chú admin</p>
            <p className="text-sm text-gray-700">{item.adminNote}</p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {isAction ? 'Hủy' : 'Đóng'}
          </button>

          {mode === 'approve' && (
            <button
              onClick={handleSubmit}
              disabled={submitting || refund.amount === 0}
              title={refund.amount === 0 ? 'Không thể hoàn tiền vì khách đã xem bất động sản' : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Xác nhận hoàn {fmtAmount(refund.amount)}
            </button>
          )}

          {mode === 'reject' && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition"
            >
              {submitting && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Xác nhận từ chối
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const RefundManagementPage: React.FC = () => {
  const [items, setItems]     = useState<RefundItem[]>([]);
  const [meta, setMeta]       = useState<Meta>({ total: 0, page: 1, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [search, setSearch]   = useState('');

  const [modal, setModal] = useState<{ item: RefundItem; mode: 'detail' | 'approve' | 'reject' } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await depositApi.getAdminRefunds({ page, limit: PAGE_SIZE, status: statusFilter });
      const data = res.data?.data || [];
      const metaData = res.data?.meta || { total: 0, page: 1, lastPage: 1 };
      setItems(data);
      setMeta(metaData);
    } catch {
      toast.error('Không tải được danh sách hoàn tiền');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (r) =>
        r.user?.fullName?.toLowerCase().includes(q) ||
        r.user?.phone?.includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        String(r.id).includes(q),
    );
  }, [items, search]);

  const stats = useMemo(() => ({
    total:    meta.total,
    pending:  meta.totalPending  ?? items.filter((r) => r.status === 2).length,
    approved: meta.totalApproved ?? items.filter((r) => r.status === 3).length,
    rejected: meta.totalRejected ?? items.filter((r) => r.status === 1).length,
  }), [meta, items]);

  const handleFilterChange = (s: number | undefined) => {
    setStatusFilter(s);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50/70">
      <main className="mx-auto max-w-7xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Quản lý hoàn tiền đặt cọc
            </h1>
            <p className="mt-0.5 text-sm text-gray-400">{meta.total} yêu cầu tổng cộng</p>
          </div>
          {/* Policy hint */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
            <span className="font-semibold">Chính sách hoàn tiền:</span>
            {' '}Chưa xem nhà → hoàn <span className="font-bold">95%</span> &nbsp;|&nbsp;
            Đã xem nhà → <span className="font-bold text-red-600">không hoàn</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Tổng yêu cầu', val: meta.total,     color: 'text-gray-800'  },
            { label: 'Chờ duyệt',    val: stats.pending,  color: 'text-amber-600' },
            { label: 'Đã hoàn tiền', val: stats.approved, color: 'text-green-600' },
            { label: 'Từ chối',      val: stats.rejected, color: 'text-red-500'   },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={`mt-1 text-3xl font-extrabold ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, SĐT, mã..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {([
            { label: 'Tất cả',    val: undefined },
            { label: 'Chờ duyệt', val: 2 },
            { label: 'Đã hoàn',   val: 3 },
            { label: 'Từ chối',   val: 1 },
          ] as { label: string; val: number | undefined }[]).map((tab) => (
            <button
              key={String(tab.val)}
              onClick={() => handleFilterChange(tab.val)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.val
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Mã', 'Khách hàng', 'Tiền cọc', 'Được hoàn', 'Lịch hẹn', 'Ngày gửi', 'Trạng thái', 'Hành động'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <Skeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    Không có yêu cầu hoàn tiền nào
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const cfg = STATUS_CFG[row.status];
                  const refund = calcRefund(row);
                  const met = row.appointment?.actualStatus === 1;

                  return (
                    <tr key={row.id} className="group transition hover:bg-gray-50/60">
                      {/* Mã */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-400">#{row.id}</span>
                      </td>

                      {/* Khách hàng */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{row.user?.fullName}</p>
                        <p className="text-xs text-gray-400">{row.user?.phone}</p>
                      </td>

                      {/* Tiền cọc */}
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {fmtAmount(row.amount)}
                      </td>

                      {/* Được hoàn — tính theo quy tắc */}
                      <td className="px-4 py-3">
                        {row.status === 3 ? (
                          // Đã xử lý → hiển thị số thực tế từ DB
                          <span className="font-semibold text-green-600">
                            {fmtAmount(row.refundAmount)}
                          </span>
                        ) : met ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                            Không hoàn
                          </span>
                        ) : (
                          <span className="font-semibold text-orange-500">
                            {fmtAmount(refund.amount)}
                            <span className="ml-1 text-[10px] font-normal text-gray-400">(95%)</span>
                          </span>
                        )}
                      </td>

                      {/* Lịch hẹn */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">#{row.appointment?.id}</p>
                        <p className={`text-[11px] font-medium ${met ? 'text-green-600' : 'text-gray-400'}`}>
                          {met ? '✓ Đã gặp' : 'Chưa gặp'}
                        </p>
                      </td>

                      {/* Ngày gửi */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {fmtDate(row.updatedAt)}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        {cfg && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        )}
                      </td>

                      {/* Hành động */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.status === 2 && (
                            <>
                              <button
                                onClick={() => setModal({ item: row, mode: 'approve' })}
                                disabled={met}
                                title={met ? 'Không thể hoàn tiền — khách đã xem nhà' : undefined}
                                className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Hoàn tiền
                              </button>
                              <button
                                onClick={() => setModal({ item: row, mode: 'reject' })}
                                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setModal({ item: row, mode: 'detail' })}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.lastPage > 1 && (
          <div className="mt-5 flex items-center justify-end gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {Array.from({ length: meta.lastPage }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition ${
                  p === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
              disabled={page === meta.lastPage}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <RefundModal
          item={modal.item}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default RefundManagementPage;