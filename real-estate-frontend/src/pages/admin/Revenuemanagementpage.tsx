
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { revenueApi } from '@/api';
import type { RevenueStats, PaymentItem, RevenueGroupBy } from '@/api/revenue';
import { Badge, Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_CLASS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_CLASS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLOR,
  REVENUE_GROUP_BY_LABELS,
} from '@/constants/Revenue';

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentTypeFilter = 'all' | 'ACCOUNT_VIP' | 'POST_VIP' | 'PROPERTY_DEPOSIT';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (v: number) => {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + ' tr';
  return v.toLocaleString('vi-VN') + ' đ';
};

const fmtMoneyFull = (v: number) => v.toLocaleString('vi-VN') + ' đ';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const today = () => new Date().toISOString().slice(0, 10);

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

// ── KpiCard ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:      string;
  value:      string;
  sub?:       string;
  change?:    number | null;
  highlight?: boolean;
  active?:    boolean;
  clickable?: boolean;
  onClick?:   () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label, value, sub, change, highlight, active, clickable, onClick,
}) => (
  <div
    onClick={onClick}
    className={[
      'rounded-xl border p-4 transition-all duration-150',
      clickable ? 'cursor-pointer' : '',
      active
        ? 'border-brand-500 ring-2 ring-brand-400 bg-brand-50'
        : highlight
          ? 'border-brand-200 bg-brand-50'
          : 'border-gray-200 bg-white',
      clickable && !active ? 'hover:border-gray-300 hover:shadow-sm' : '',
    ].join(' ')}
  >
    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-semibold ${active || highlight ? 'text-brand-700' : 'text-gray-900'}`}>
      {value}
    </p>
    {(sub !== undefined || change !== undefined) && (
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
        {change !== null && change !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
            change > 0
              ? 'bg-green-50 text-green-700'
              : change < 0
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {change > 0 ? '↑' : change < 0 ? '↓' : '—'} {Math.abs(change)}%
          </span>
        )}
      </div>
    )}
    {clickable && (
      <p className="mt-1.5 text-[10px] text-gray-400">
        {active ? '✓ Đang lọc · bấm để bỏ' : 'Bấm để lọc'}
      </p>
    )}
  </div>
);

// ── BarChart ──────────────────────────────────────────────────────────────────

interface BarChartProps {
  data:       { label: string; accountVip: number; postVip: number; deposit: number }[];
  groupBy:    RevenueGroupBy;
  typeFilter: PaymentTypeFilter;
}

const BarChart: React.FC<BarChartProps> = ({ data, groupBy, typeFilter }) => {
  const getValue = (d: typeof data[0]) => {
    if (typeFilter === 'ACCOUNT_VIP')      return d.accountVip;
    if (typeFilter === 'POST_VIP')         return d.postVip;
    if (typeFilter === 'PROPERTY_DEPOSIT') return d.deposit;
    return d.accountVip + d.postVip + d.deposit;
  };

  const maxVal = Math.max(...data.map(getValue), 1);

  const showLabel = (label: string) =>
    groupBy === 'year' ? label : label.slice(5);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-40 min-w-max px-1">
        {data.map((d) => {
          const displayVal = getValue(d);
          const heightPct  = Math.round((displayVal / maxVal) * 100);
          const total      = d.accountVip + d.postVip + d.deposit;

          // Tỉ lệ từng phần trong cột (chỉ dùng khi all)
          const acctPct = total > 0 ? Math.round((d.accountVip / total) * 100) : 0;
          const postPct = total > 0 ? Math.round((d.postVip    / total) * 100) : 0;
          const depPct  = total > 0 ? 100 - acctPct - postPct               : 0;

          return (
            <div key={d.label} className="flex flex-col items-center gap-1 w-9 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-md text-xs text-gray-700 pointer-events-none">
                <div className="font-medium text-gray-900 mb-1">{d.label}</div>
                {(typeFilter === 'all' || typeFilter === 'ACCOUNT_VIP') && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" />
                    Acct VIP: {fmtMoney(d.accountVip)}
                  </div>
                )}
                {(typeFilter === 'all' || typeFilter === 'POST_VIP') && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-sm bg-teal-500 inline-block" />
                    Post VIP: {fmtMoney(d.postVip)}
                  </div>
                )}
                {(typeFilter === 'all' || typeFilter === 'PROPERTY_DEPOSIT') && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />
                    Đặt cọc: {fmtMoney(d.deposit)}
                  </div>
                )}
              </div>

              {/* Stacked / single bar */}
              <div
                className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                style={{ height: `${heightPct}%`, minHeight: displayVal > 0 ? 4 : 0 }}
              >
                {typeFilter === 'all' ? (
                  <>
                    <div style={{ height: `${acctPct}%` }} className="bg-purple-500 w-full" />
                    <div style={{ height: `${postPct}%` }} className="bg-teal-500 w-full" />
                    <div style={{ height: `${depPct}%`  }} className="bg-orange-400 w-full" />
                  </>
                ) : (
                  <div className={`w-full h-full ${
                    typeFilter === 'ACCOUNT_VIP'      ? 'bg-purple-500' :
                    typeFilter === 'POST_VIP'         ? 'bg-teal-500'   : 'bg-orange-400'
                  }`} />
                )}
              </div>

              <span className="text-[10px] text-gray-400 leading-none">{showLabel(d.label)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── DonutChart ────────────────────────────────────────────────────────────────

interface DonutProps {
  success: number;
  failed:  number;
  pending: number;
  total:   number;
}

const DonutChart: React.FC<DonutProps> = ({ success, failed, pending, total }) => {
  const r = 38, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const slices = [
    { value: success, color: '#16a34a' },
    { value: failed,  color: '#dc2626' },
    { value: pending, color: '#f59e0b' },
  ];
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      ) : slices.map((s, i) => {
        const pct  = s.value / total;
        const dash = pct * circumference;
        const gap  = circumference - dash;
        const el   = (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth="12"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circumference}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += pct;
        return el;
      })}
      <text x={cx} y={cy - 5}  textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">{success}</text>
      <text x={cx} y={cy + 9}  textAnchor="middle" fontSize="8"  fill="#6b7280">thành công</text>
    </svg>
  );
};

// ── Pill ──────────────────────────────────────────────────────────────────────

const Pill: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
    {label}
  </span>
);

// ── TYPE_TAB config ───────────────────────────────────────────────────────────

const TYPE_TABS: { value: PaymentTypeFilter; label: string }[] = [
  { value: 'all',               label: 'Tất cả'       },
  { value: 'ACCOUNT_VIP',       label: 'Account VIP'  },
  { value: 'POST_VIP',          label: 'Post VIP'     },
  { value: 'PROPERTY_DEPOSIT',  label: 'Đặt cọc'      },
];

const TYPE_BADGE: Record<Exclude<PaymentTypeFilter, 'all'>, string> = {
  ACCOUNT_VIP:      'bg-purple-100 text-purple-800 border border-purple-300',
  POST_VIP:         'bg-teal-100 text-teal-800 border border-teal-300',
  PROPERTY_DEPOSIT: 'bg-orange-100 text-orange-800 border border-orange-300',
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const RevenueManagementPage: React.FC = () => {

  // ── date / groupBy filter (pending — chỉ apply khi bấm nút) ───────────────
  const [groupBy,   setGroupBy]   = useState<RevenueGroupBy>('month');
  const [startDate, setStartDate] = useState(monthsAgo(12));
  const [endDate,   setEndDate]   = useState(today());
  const pendingStart = useRef(startDate);
  const pendingEnd   = useRef(endDate);
  const pendingGroup = useRef<RevenueGroupBy>(groupBy);

  // ── type tab (instant) ────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<PaymentTypeFilter>('all');

  // ── stats ─────────────────────────────────────────────────────────────────
  const [stats,        setStats]        = useState<RevenueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── table ─────────────────────────────────────────────────────────────────
  const [payments,     setPayments]     = useState<PaymentItem[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [tMethod,      setTMethod]      = useState('');
  const [tStatus,      setTStatus]      = useState('');
  const [search,       setSearch]       = useState('');

  const PAGE_SIZE = 10;

  // ── loadStats ─────────────────────────────────────────────────────────────
  const loadStats = useCallback(async (sd: string, ed: string, gb: RevenueGroupBy) => {
    setStatsLoading(true);
    try {
      const res = await revenueApi.getStats({ startDate: sd, endDate: ed, groupBy: gb });
      setStats(res.data.data);
    } catch {
      toast.error('Không thể tải dữ liệu thống kê');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── loadPayments ──────────────────────────────────────────────────────────
  const loadPayments = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await revenueApi.getPayments({
        page,
        limit:     PAGE_SIZE,
        search:    search    || undefined,
        method:    tMethod   || undefined,
        status:    tStatus   || undefined,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
        ...(typeFilter !== 'all' && { type: typeFilter }),
      });
      setPayments(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      toast.error('Không thể tải danh sách giao dịch');
    } finally {
      setTableLoading(false);
    }
  }, [page, search, tMethod, tStatus, typeFilter, startDate, endDate]);

  // mount — load stats một lần
  useEffect(() => {
    loadStats(startDate, endDate, groupBy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-load payments khi dependency thay đổi
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ── handleApply — áp dụng date range & groupBy ────────────────────────────
  const handleApply = () => {
    const sd = pendingStart.current;
    const ed = pendingEnd.current;
    const gb = pendingGroup.current;

    // Cập nhật state → loadPayments tự trigger qua useEffect
    setStartDate(sd);
    setEndDate(ed);
    setGroupBy(gb);
    setPage(1);

    // Stats cần gọi thủ công (không nằm trong loadPayments)
    loadStats(sd, ed, gb);
  };

  // ── handleTypeTab ─────────────────────────────────────────────────────────
  const handleTypeTab = (val: PaymentTypeFilter) => {
    setTypeFilter(val);
    setPage(1);
  };

  // ── KPI card click — toggle type filter ───────────────────────────────────
  const handleKpiClick = (type: Exclude<PaymentTypeFilter, 'all'>) => {
    setTypeFilter(prev => prev === type ? 'all' : type);
    setPage(1);
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = 'ID,Khách hàng,Email,Loại,Phương thức,Số tiền,Trạng thái,Ngày tạo';
    const rows = payments.map(p =>
      `${p.id},"${p.user?.fullName ?? ''}","${p.user?.email ?? ''}",` +
      `${p.paymentType},${p.paymentMethod},${p.amount},` +
      `${PAYMENT_STATUS_LABELS[p.status] ?? ''},${fmtDate(p.createdAt)}`
    );
    const csv  = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `doanh-thu-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns: Column<PaymentItem>[] = [
    {
      title: 'ID', dataIndex: 'id', key: 'id', width: 70,
      render: (v: number) => <span className="font-mono text-xs text-gray-400">#{v}</span>,
    },
    {
      title: 'Khách hàng', key: 'user',
      render: (_: unknown, r: PaymentItem) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{r.user?.fullName ?? 'N/A'}</div>
          <div className="text-xs text-gray-400">{r.user?.email ?? ''}</div>
        </div>
      ),
    },
    {
      title: 'Loại', dataIndex: 'paymentType', key: 'paymentType',
      render: (v: string) => (
        <Pill label={PAYMENT_TYPE_LABELS[v] ?? v} className={PAYMENT_TYPE_CLASS[v] ?? 'bg-gray-100 text-gray-600'} />
      ),
    },
    {
      title: 'Phương thức', dataIndex: 'paymentMethod', key: 'paymentMethod',
      render: (v: string) => (
        <Pill label={PAYMENT_METHOD_LABELS[v] ?? v} className={PAYMENT_METHOD_CLASS[v] ?? 'bg-gray-100 text-gray-600'} />
      ),
    },
    {
      title: 'Gói / Bài đăng', key: 'detail', ellipsis: true,
      render: (_: unknown, r: PaymentItem) => (
        <span className="text-xs text-gray-600">
          {r.subscription?.package?.name ?? r.subscription?.post?.title ?? '—'}
        </span>
      ),
    },
    {
      title: 'Số tiền', dataIndex: 'amount', key: 'amount',
      render: (v: number) => (
        <span className="font-semibold text-gray-900 text-sm">{fmtMoneyFull(v)}</span>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      render: (v: number) => (
        <Badge color={PAYMENT_STATUS_COLOR[v] ?? 'light'}>{PAYMENT_STATUS_LABELS[v] ?? '—'}</Badge>
      ),
    },
    {
      title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span className="text-xs text-gray-500">{fmtDate(v)}</span>,
    },
  ];

  const s = stats;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header + date filter ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-gray-900">Quản lý doanh thu</h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* GroupBy */}
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            defaultValue={groupBy}
            onChange={(e) => { pendingGroup.current = e.target.value as RevenueGroupBy; }}
          >
            {Object.entries(REVENUE_GROUP_BY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {/* Start date */}
          <input
            type="date"
            defaultValue={startDate}
            onChange={(e) => { pendingStart.current = e.target.value; }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-gray-400 text-sm select-none">→</span>

          {/* End date */}
          <input
            type="date"
            defaultValue={endDate}
            onChange={(e) => { pendingEnd.current = e.target.value; }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <Button variant="primary" onClick={handleApply} loading={statsLoading}>
            Áp dụng
          </Button>
        </div>
      </div>

      {/* ── Active filter banner ─────────────────────────────────────────── */}
      {typeFilter !== 'all' && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${TYPE_BADGE[typeFilter]}`}>
          <span>
            Đang xem: <strong>
              {TYPE_TABS.find(t => t.value === typeFilter)?.label}
            </strong>
            {' '}· {startDate} → {endDate}
          </span>
          <button
            onClick={() => handleTypeTab('all')}
            className="ml-4 rounded-lg px-2 py-0.5 text-xs opacity-70 hover:opacity-100 hover:bg-black/10 transition-all"
          >
            Xoá lọc ✕
          </button>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Tổng — không clickable */}
        <KpiCard
          label="Tổng doanh thu"
          value={fmtMoney(s?.summary.totalRevenue ?? 0)}
          change={s?.comparison.revenueChange}
          sub="so với kỳ trước"
          highlight={typeFilter === 'all'}
        />

        {/* Account VIP */}
        <KpiCard
          label="Account VIP"
          value={fmtMoney(s?.summary.accountVip.revenue ?? 0)}
          sub={`${s?.summary.accountVip.count ?? 0} giao dịch`}
          active={typeFilter === 'ACCOUNT_VIP'}
          clickable
          onClick={() => handleKpiClick('ACCOUNT_VIP')}
        />

        {/* Post VIP */}
        <KpiCard
          label="Post VIP"
          value={fmtMoney(s?.summary.postVip.revenue ?? 0)}
          sub={`${s?.summary.postVip.count ?? 0} giao dịch`}
          active={typeFilter === 'POST_VIP'}
          clickable
          onClick={() => handleKpiClick('POST_VIP')}
        />

        {/* Đặt cọc */}
        <KpiCard
          label="Đặt cọc"
          value={fmtMoney(s?.summary.deposit.revenue ?? 0)}
          sub={`${s?.summary.deposit.count ?? 0} giao dịch`}
          active={typeFilter === 'PROPERTY_DEPOSIT'}
          clickable
          onClick={() => handleKpiClick('PROPERTY_DEPOSIT')}
        />

        {/* Tỉ lệ thành công */}
        <KpiCard
          label="Tỉ lệ thành công"
          value={`${s?.transactionStatus.successRate ?? 0}%`}
          sub={`${s?.transactionStatus.success ?? 0} / ${s?.transactionStatus.total ?? 0} GD`}
          change={s?.comparison.countChange}
        />
      </div>

      {/* ── Chart row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Bar chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700">Doanh thu theo thời gian</p>
              {typeFilter !== 'all' && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[typeFilter]}`}>
                  {TYPE_TABS.find(t => t.value === typeFilter)?.label}
                </span>
              )}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {(typeFilter === 'all' || typeFilter === 'ACCOUNT_VIP') && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  Account VIP
                </span>
              )}
              {(typeFilter === 'all' || typeFilter === 'POST_VIP') && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-500" />
                  Post VIP
                </span>
              )}
              {(typeFilter === 'all' || typeFilter === 'PROPERTY_DEPOSIT') && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400" />
                  Đặt cọc
                </span>
              )}
            </div>
          </div>

          {statsLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">
              Đang tải...
            </div>
          ) : (
            <BarChart
              data={s?.chartData ?? []}
              groupBy={groupBy}
              typeFilter={typeFilter}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">

          {/* Donut */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Trạng thái giao dịch</p>
            <div className="flex items-center gap-4">
              <DonutChart
                success={s?.transactionStatus.success ?? 0}
                failed={s?.transactionStatus.failed   ?? 0}
                pending={s?.transactionStatus.pending  ?? 0}
                total={s?.transactionStatus.total      ?? 0}
              />
              <div className="flex flex-col gap-2 text-xs text-gray-600 flex-1 min-w-0">
                {[
                  { label: 'Thành công', value: s?.transactionStatus.success ?? 0, color: 'bg-green-500' },
                  { label: 'Thất bại',   value: s?.transactionStatus.failed   ?? 0, color: 'bg-red-500'   },
                  { label: 'Chờ xử lý', value: s?.transactionStatus.pending   ?? 0, color: 'bg-amber-400' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                    <span className="flex-1 truncate">{row.label}</span>
                    <span className="font-medium text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Method breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Phương thức thanh toán</p>
            {statsLoading ? (
              <div className="text-xs text-gray-400">Đang tải...</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {(s?.methodBreakdown ?? []).map((m) => {
                  const totalRev = (s?.methodBreakdown ?? []).reduce((a, x) => a + x.revenue, 0);
                  const pct = totalRev > 0 ? Math.round((m.revenue / totalRev) * 100) : 0;
                  return (
                    <div key={m.method}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">
                          {PAYMENT_METHOD_LABELS[m.method] ?? m.method}
                        </span>
                        <span className="text-gray-500">{fmtMoney(m.revenue)} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.method === 'vnpay' ? 'bg-blue-500' : 'bg-pink-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction Table ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white">

        {/* Table header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-700">Chi tiết giao dịch</p>
            {typeFilter !== 'all' && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE[typeFilter]}`}>
                {TYPE_TABS.find(t => t.value === typeFilter)?.label}
              </span>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTypeTab(tab.value)}
                className={[
                  'px-3 py-1.5 text-sm font-medium rounded-[10px] transition-all',
                  typeFilter === tab.value
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/60',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <input
            type="text"
            placeholder="Tìm theo tên, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-52"
          />

          <select
            value={tMethod}
            onChange={(e) => { setTMethod(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả phương thức</option>
            <option value="vnpay">VNPay</option>
            <option value="momo">MoMo</option>
          </select>

          <select
            value={tStatus}
            onChange={(e) => { setTStatus(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="1">Thành công</option>
            <option value="2">Thất bại</option>
            <option value="0">Chờ xử lý</option>
          </select>

          <div className="ml-auto">
            <Button variant="outline" onClick={handleExport}>
              Xuất CSV ↓
            </Button>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          dataSource={payments}
          rowKey="id"
          loading={tableLoading}
          pagination={{
            current:   page,
            total,
            pageSize:  PAGE_SIZE,
            onChange:  setPage,
            showTotal: (t: number) => `Tổng ${t} giao dịch`,
          }}
        />
      </div>

    </div>
  );
};

export default RevenueManagementPage;