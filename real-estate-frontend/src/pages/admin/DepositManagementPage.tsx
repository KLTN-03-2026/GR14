import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { depositApi } from '@/api/deposit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepositItem {
  id: number;
  appointmentId: number;
  userId: number;
  amount: number;
  refundAmount: number | null;
  refundAccountInfo: string | null;
  depositType: 'BEFORE_VIEWING' | 'AFTER_VIEWING';
  status: number;
  expiresAt: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
  };
  appointment?: {
    id: number;
    appointmentDate: string;
    house?: { id: number; title: string } | null;
    land?: { id: number; title: string } | null;
  };
  payment?: {
    paymentMethod: string;
    transactionId: string;
    status: number;
  } | null;
}

interface Meta {
  total: number;
  page: number;
  lastPage: number;
}

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
  0: { label: 'Chờ thanh toán',    bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400',    border: 'border-gray-200' },
  1: { label: 'Đang giữ chỗ',      bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    border: 'border-blue-200' },
  2: { label: 'Chờ hoàn tiền',     bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400',  border: 'border-orange-200' },
  3: { label: 'Đã hoàn tiền',      bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
  4: { label: 'Đã chốt mua',       bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400',  border: 'border-purple-200' },
  5: { label: 'Hết hạn / Mất cọc', bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400',     border: 'border-red-200' },
};

const DEPOSIT_TYPE_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  BEFORE_VIEWING: { label: 'Trước khi xem', bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  AFTER_VIEWING:  { label: 'Sau khi xem',   bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 9 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 animate-pulse rounded bg-gray-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DepositDetailModal: React.FC<{
  item: DepositItem;
  onClose: () => void;
  onComplete: () => void;
}> = ({ item, onClose, onComplete }) => {
  const [completing, setCompleting] = useState(false);
  const property = item.appointment?.house || item.appointment?.land;
  const cfg = STATUS_CFG[item.status];
  const typeCfg = DEPOSIT_TYPE_CFG[item.depositType];

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await depositApi.completeDeposit(item.id);
      toast.success('Đã chốt mua thành công');
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Chi tiết đặt cọc #{item.id}</h3>
            <p className="text-xs text-gray-500">Lịch hẹn #{item.appointmentId}</p>
          </div>
          {cfg && (
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          )}
        </div>

        {/* Info grid */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Khách hàng</p>
            <p className="text-sm font-semibold text-gray-800">{item.user?.fullName || '—'}</p>
            <p className="text-xs text-gray-500">{item.user?.email}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Số tiền cọc</p>
            <p className="text-sm font-bold text-blue-700">{fmtAmount(item.amount)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Loại cọc</p>
            {typeCfg && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}>
                {typeCfg.label}
              </span>
            )}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Thanh toán qua</p>
            <p className="text-sm font-semibold text-gray-700 uppercase">{item.payment?.paymentMethod ?? '—'}</p>
          </div>
        </div>

        {/* Bất động sản */}
        <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Bất động sản</p>
          <p className="text-sm font-medium text-gray-800">{property?.title ?? '—'}</p>
          <p className="text-xs text-gray-500">Ngày hẹn: {fmtDate(item.appointment?.appointmentDate)}</p>
        </div>

        {/* Thời hạn giữ chỗ */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Ngày tạo</p>
            <p className="text-xs text-gray-600">{fmtDate(item.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Hết hạn giữ chỗ</p>
            <p className="text-xs text-gray-600">{fmtDate(item.expiresAt)}</p>
          </div>
        </div>

        {/* Admin note */}
        {item.adminNote && (
          <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Ghi chú admin</p>
            <p className="text-sm text-gray-700">{item.adminNote}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Đóng
          </button>
          {item.status === 1 && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {completing && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Chốt mua
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const DepositManagementPage: React.FC = () => {
  const [items, setItems]     = useState<DepositItem[]>([]);
  const [meta, setMeta]       = useState<Meta>({ total: 0, page: 1, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [search, setSearch]   = useState('');

  const [detailItem, setDetailItem] = useState<DepositItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await depositApi.getAllDeposits({ page, limit: PAGE_SIZE, status: statusFilter });
      const data = res.data?.items || [];
      const metaData = res.data?.meta || { total: 0, page: 1, lastPage: 1 };
      setItems(data);
      setMeta(metaData);
    } catch {
      toast.error('Không tải được danh sách đặt cọc');
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
    total:     meta.total,
    holding:   items.filter((r) => r.status === 1).length,
    completed: items.filter((r) => r.status === 4).length,
    expired:   items.filter((r) => r.status === 5).length,
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
              Quản lý đặt cọc
            </h1>
            <p className="mt-0.5 text-sm text-gray-400">{meta.total} giao dịch tổng cộng</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
            <span className="font-semibold">Chính sách cọc:</span>
            {' '}Min <span className="font-bold">1 triệu</span> &nbsp;|&nbsp;
            Max <span className="font-bold">30% giá BĐS</span> &nbsp;|&nbsp;
            Hết hạn tự động <span className="font-bold">07:05 hàng ngày</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Tổng giao dịch', val: meta.total,      color: 'text-gray-800',  icon: '📊' },
            { label: 'Đang giữ chỗ',   val: stats.holding,   color: 'text-blue-600',  icon: '🔒' },
            { label: 'Đã chốt mua',    val: stats.completed, color: 'text-purple-600', icon: '✅' },
            { label: 'Hết hạn',        val: stats.expired,   color: 'text-red-500',   icon: '⏰' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
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
            { label: 'Tất cả',         val: undefined },
            { label: 'Chờ thanh toán', val: 0 },
            { label: 'Đang giữ chỗ',   val: 1 },
            { label: 'Chờ hoàn tiền',  val: 2 },
            { label: 'Đã hoàn tiền',   val: 3 },
            { label: 'Đã chốt mua',    val: 4 },
            { label: 'Hết hạn',        val: 5 },
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
                {['Mã', 'Khách hàng', 'Bất động sản', 'Số tiền', 'Loại cọc', 'Trạng thái', 'Hết hạn', 'Ngày tạo', 'Hành động'].map((h) => (
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
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    Không có giao dịch đặt cọc nào
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const cfg = STATUS_CFG[row.status];
                  const typeCfg = DEPOSIT_TYPE_CFG[row.depositType];
                  const property = row.appointment?.house || row.appointment?.land;

                  return (
                    <tr key={row.id} className="group transition hover:bg-gray-50/60 cursor-pointer" onClick={() => setDetailItem(row)}>
                      {/* Mã */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-400">#{row.id}</span>
                      </td>

                      {/* Khách hàng */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{row.user?.fullName || '—'}</p>
                        <p className="text-xs text-gray-400">{row.user?.email}</p>
                      </td>

                      {/* Bất động sản */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-sm text-gray-700">{property?.title || '—'}</p>
                      </td>

                      {/* Số tiền */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-700">{fmtAmount(row.amount)}</span>
                      </td>

                      {/* Loại cọc */}
                      <td className="px-4 py-3">
                        {typeCfg && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}>
                            {typeCfg.label}
                          </span>
                        )}
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

                      {/* Hết hạn */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {fmtDate(row.expiresAt)}
                      </td>

                      {/* Ngày tạo */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {fmtDate(row.createdAt)}
                      </td>

                      {/* Hành động */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {row.status === 1 && (
                            <button
                              onClick={() => setDetailItem(row)}
                              className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
                            >
                              Chốt mua
                            </button>
                          )}
                          <button
                            onClick={() => setDetailItem(row)}
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

      {/* Detail Modal */}
      {detailItem && (
        <DepositDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onComplete={fetchData}
        />
      )}
    </div>
  );
};

export default DepositManagementPage;
