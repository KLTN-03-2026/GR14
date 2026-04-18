import { useEffect, useState, createContext, useContext } from "react";
import {
  TrendingUp,
  FileText,
  DollarSign,
  Calendar,
  Heart,
  BarChart2,
  LayoutDashboard,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
} from "lucide-react";
import { houseApi, landApi, appointmentApi } from "@/api";
import { userApi, postApi } from "@/api";
import { analyticsApi } from "@/api/analytics";
import type {
  TimeType,
  AnalyticsContextValue,
  TimeSeriesPoint,
  LocationStat,
  AppointmentRates,
} from "@/types/analytics";

// ─── Chart components ─────────────────────────────────────────────────────────
import {
  AnalyticsAreaChart,
  AnalyticsDonutChart,
  HorizontalBar,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

// ─── Sub-page chart components ────────────────────────────────────────────────
import UserGrowthPage from "./analytics/user-growth";
import PostAnalyticsPage from "./analytics/post";
import RevenueAnalyticsPage from "./analytics/revenue";
import AppointmentAnalyticsPage from "./analytics/appointment";
import BehaviorAnalyticsPage from "./analytics/behavior";
import EmployeeAnalyticsPage from "./analytics/employee";
//import EmployeeAnalyticsPage from "./analytics/employee";
// ─── Analytics Context ────────────────────────────────────────────────────────
export const AnalyticsContext = createContext<AnalyticsContextValue>({
  timeType: "month",
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

// ─── Tab config ───────────────────────────────────────────────────────────────
type TabKey =
  | "overview"
  | "user"
  | "post"
  | "revenue"
  | "appointment"
  | "behavior"
  | "employee";

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  activeColor: string;
}

const TABS: Tab[] = [
  {
    key: "overview",
    label: "Tổng quan",
    icon: LayoutDashboard,
    activeColor: "#6366f1",
  },
  {
    key: "user",
    label: "Người dùng",
    icon: TrendingUp,
    activeColor: "#8b5cf6",
  },
  {
    key: "post",
    label: "Bài đăng",
    icon: FileText,
    activeColor: "#3b82f6",
  },
  {
    key: "revenue",
    label: "Doanh thu",
    icon: DollarSign,
    activeColor: "#10b981",
  },
  {
    key: "appointment",
    label: "Lịch hẹn",
    icon: Calendar,
    activeColor: "#f59e0b",
  },
  {
    key: "behavior",
    label: "Hành vi",
    icon: Heart,
    activeColor: "#f43f5e",
  },
  {
    key: "employee",
    label: "Nhân viên",
    icon: Activity,
    activeColor: "#0ea5e9",
  },
];

const TIME_OPTIONS: { value: TimeType; label: string }[] = [
  { value: "day", label: "Theo ngày" },
  { value: "month", label: "Theo tháng" },
  { value: "year", label: "Theo năm" },
];

// ─── Overview stats card types ─────────────────────────────────────────────────
interface StatCard {
  title: string;
  value: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

// ─── Shared card shell ────────────────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  children,
  headerRight,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm p-6"
      style={{ border: "1px solid #e5e7eb" }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-gray-800 font-semibold text-base">{title}</h3>
          {subtitle && (
            <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

// ─── Overview Panel ────────────────────────────────────────────────────────────
interface OverviewPanelProps {
  stats: {
    houses: number;
    lands: number;
    users: number;
    appointments: number;
    posts: number;
  };
}

function OverviewPanel({ stats }: OverviewPanelProps) {
  const statCards: StatCard[] = [
    {
      title: "Nhà",
      value: stats.houses,
      color: "text-brand-500",
      bgColor: "bg-brand-50",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      title: "Đất",
      value: stats.lands,
      color: "text-success-500",
      bgColor: "bg-success-50",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      title: "Người dùng",
      value: stats.users,
      color: "text-blue-light-500",
      bgColor: "bg-blue-light-50",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      title: "Lịch hẹn",
      value: stats.appointments,
      color: "text-warning-500",
      bgColor: "bg-warning-50",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: "Bài đăng",
      value: stats.posts,
      color: "text-error-500",
      bgColor: "bg-error-50",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards.map((card) => (
        <div
          key={card.title}
          className="admin-form-surface rounded-2xl border p-5"
          style={{
            background: "#ffffff",
            borderColor: "#e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {card.title}
              </p>
              <p
                className={`text-3xl font-extrabold tracking-tight ${card.color}`}
              >
                {card.value}
              </p>
            </div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bgColor} ${card.color}`}
            >
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// === Added Analytics Section ===
// =============================================================================

// ─── 1. User Growth Chart ─────────────────────────────────────────────────────
function UserGrowthCard() {
  const [growth, setGrowth] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeType, setTimeType] = useState<"month" | "year">("month");

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .getUserGrowth(timeType)
      .then((data: TimeSeriesPoint[]) => setGrowth(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const toggleBtn = (
    <div
      className="flex items-center gap-1 rounded-lg p-1"
      style={{ background: "#f1f5f9", border: "1px solid #e5e7eb" }}
    >
      {(["month", "year"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTimeType(t)}
          className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150"
          style={
            timeType === t
              ? { background: "#6366f1", color: "#fff" }
              : { color: "#64748b" }
          }
        >
          {t === "month" ? "Tháng" : "Năm"}
        </button>
      ))}
    </div>
  );

  return (
    <SectionCard
      title="Tăng trưởng người dùng"
      subtitle="Số lượng người dùng mới theo thời gian"
      headerRight={toggleBtn}
    >
      {loading ? (
        <ChartSkeleton height={240} />
      ) : growth.length === 0 ? (
        <EmptyState message="Không có dữ liệu tăng trưởng" />
      ) : (
        <AnalyticsAreaChart
          data={growth as unknown as Record<string, unknown>[]}
          dataKey="total"
          xKey="time"
          name="Người dùng mới"
          color="#6366f1"
          height={240}
        />
      )}
    </SectionCard>
  );
}

// ─── 2. Property Distribution Donut ───────────────────────────────────────────
const DONUT_COLORS = ["#6366f1", "#10b981"];

function PropertyDistributionCard({
  houses,
  lands,
}: {
  houses: number;
  lands: number;
}) {
  const total = houses + lands;
  const data = [
    { name: "Nhà", value: houses },
    { name: "Đất", value: lands },
  ];
  const hPct = total > 0 ? ((houses / total) * 100).toFixed(1) : "0";
  const lPct = total > 0 ? ((lands / total) * 100).toFixed(1) : "0";

  return (
    <SectionCard
      title="Phân bổ bất động sản"
      subtitle="Tỷ lệ Nhà và Đất trong hệ thống"
    >
      {total === 0 ? (
        <EmptyState message="Chưa có dữ liệu bất động sản" />
      ) : (
        <>
          <AnalyticsDonutChart
            data={data}
            nameKey="name"
            valueKey="value"
            colors={DONUT_COLORS}
            height={200}
          />
          {/* Summary row */}
          <div
            className="flex gap-4 mt-4 pt-4"
            style={{ borderTop: "1px solid #f1f5f9" }}
          >
            {[
              { label: "Nhà", value: houses, pct: hPct, color: "#6366f1" },
              { label: "Đất", value: lands, pct: lPct, color: "#10b981" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex-1 rounded-xl p-3 text-center"
                style={{
                  background: `${item.color}08`,
                  border: `1px solid ${item.color}20`,
                }}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: item.color }}
                >
                  {item.label}
                </div>
                <div className="text-xl font-bold text-gray-800">
                  {item.value.toLocaleString("vi-VN")}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{item.pct}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── 3. Top Locations ─────────────────────────────────────────────────────────
function TopLocationsCard() {
  const [locations, setLocations] = useState<LocationStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .getTopLocations()
      .then((data: LocationStat[]) => setLocations(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const top = locations.slice(0, 7);
  const maxTotal = top[0]?.total ?? 1;

  return (
    <SectionCard
      title="Top khu vực"
      subtitle="Tỉnh / thành phố có nhiều bất động sản nhất"
      headerRight={
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: "#f43f5e14", color: "#f43f5e" }}
        >
          <MapPin size={11} />
          {locations.length} khu vực
        </span>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-lg animate-pulse"
              style={{ background: "#f1f5f9", width: `${88 - i * 9}%` }}
            />
          ))}
        </div>
      ) : top.length === 0 ? (
        <EmptyState message="Không có dữ liệu khu vực" />
      ) : (
        <div className="space-y-4">
          {top.map((loc, idx) => (
            <div key={loc.city}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={
                      idx < 3
                        ? { background: "#f59e0b18", color: "#f59e0b" }
                        : { background: "#f1f5f9", color: "#94a3b8" }
                    }
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {loc.city}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "#6366f114", color: "#6366f1" }}
                  >
                    {loc.houses} nhà
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "#10b98114", color: "#10b981" }}
                  >
                    {loc.lands} đất
                  </span>
                </div>
              </div>
              {/* Progress bar — suppress the label since we show it above */}
              <HorizontalBar
                label=""
                value={loc.total}
                max={maxTotal}
                color={idx < 3 ? "#6366f1" : "#94a3b8"}
                suffix=" tin"
              />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── 4. Appointment Pipeline ──────────────────────────────────────────────────
const PIPELINE_ITEMS: {
  key: keyof AppointmentRates;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  bg: string;
}[] = [
  {
    key: "pending",
    label: "Chờ duyệt",
    icon: Clock,
    color: "#f59e0b",
    bg: "#f59e0b0d",
  },
  {
    key: "approved",
    label: "Đã duyệt",
    icon: CheckCircle2,
    color: "#10b981",
    bg: "#10b9810d",
  },
  {
    key: "completed",
    label: "Hoàn thành",
    icon: Activity,
    color: "#6366f1",
    bg: "#6366f10d",
  },
  {
    key: "rejected",
    label: "Từ chối",
    icon: XCircle,
    color: "#ef4444",
    bg: "#ef44440d",
  },
];

function AppointmentPipelineCard() {
  const [rates, setRates] = useState<AppointmentRates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .getAppointmentRates()
      .then((data: AppointmentRates) => setRates(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SectionCard
      title="Pipeline lịch hẹn"
      subtitle="Trạng thái tổng hợp toàn bộ lịch hẹn trong hệ thống"
      headerRight={
        rates ? (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "#6366f114", color: "#6366f1" }}
          >
            {rates.total.toLocaleString("vi-VN")} tổng
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl animate-pulse"
              style={{ background: "#f1f5f9" }}
            />
          ))}
        </div>
      ) : !rates ? (
        <EmptyState message="Không có dữ liệu lịch hẹn" />
      ) : (
        <>
          {/* 4 status tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {PIPELINE_ITEMS.map(({ key, label, icon: Icon, color, bg }) => {
              const count = rates[key] as number;
              const pct =
                rates.total > 0
                  ? ((count / rates.total) * 100).toFixed(0)
                  : "0";
              return (
                <div
                  key={key}
                  className="rounded-xl p-4"
                  style={{
                    background: bg,
                    border: `1px solid ${color}20`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={15} style={{ color }} />
                    <span className="text-xs font-medium" style={{ color }}>
                      {label}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {count.toLocaleString("vi-VN")}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {pct}% tổng số
                  </div>
                </div>
              );
            })}
          </div>

          {/* Completion rate bar */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Tỷ lệ hoàn thành
              </span>
              <span className="text-sm font-bold" style={{ color: "#6366f1" }}>
                {(rates.completionRate * 100).toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: "#e5e7eb" }}
            >
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{
                  width: `${(rates.completionRate * 100).toFixed(1)}%`,
                  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-gray-400">
                {rates.completed} hoàn thành / {rates.total} tổng
              </span>
              <span className="text-xs" style={{ color: "#ef4444" }}>
                Từ chối: {(rates.rejectionRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Overview Analytics Section ───────────────────────────────────────────────
function OverviewAnalyticsSection({
  houses,
  lands,
}: {
  houses: number;
  lands: number;
}) {
  return (
    <div className="mt-6 space-y-6">
      {/* === Added Analytics Section === */}

      {/* Row 1: Growth Chart (left) + Property Distribution (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthCard />
        <PropertyDistributionCard houses={houses} lands={lands} />
      </div>

      {/* Row 2: Top Locations (left) + Appointment Pipeline (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopLocationsCard />
        <AppointmentPipelineCard />
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [timeType, setTimeType] = useState<TimeType>("month");

  const [stats, setStats] = useState({
    houses: 0,
    lands: 0,
    users: 0,
    appointments: 0,
    posts: 0,
  });

  async function loadStats() {
    try {
      const [housesRes, landsRes, usersRes, appointmentsRes, postsRes] =
        await Promise.allSettled([
          houseApi.getAll({ limit: 1 }),
          landApi.getAll({ limit: 1 }),
          userApi.getAll({ limit: 1 }),
          appointmentApi.getAll({ limit: 1 } as any),
          postApi.getAll({ limit: 1 } as any),
        ]);

      setStats({
        houses:
          housesRes.status === "fulfilled"
            ? housesRes.value.data.totalItems || 0
            : 0,
        lands:
          landsRes.status === "fulfilled"
            ? landsRes.value.data.totalItems || 0
            : 0,
        users:
          usersRes.status === "fulfilled"
            ? usersRes.value.data.totalItems || 0
            : 0,
        appointments:
          appointmentsRes.status === "fulfilled"
            ? appointmentsRes.value.data.totalItems || 0
            : 0,
        posts:
          postsRes.status === "fulfilled"
            ? postsRes.value.data.totalItems || 0
            : 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <AnalyticsContext.Provider value={{ timeType }}>
      <div
        className="min-h-screen"
        style={{
          background: "#f8fafc",
        }}
      >
        {/* ── Top Bar ── */}
        <div
          className="border-b"
          style={{ borderColor: "#e5e7eb", background: "#ffffff" }}
        >
          <div className="max-w-screen-2xl mx-auto px-6 py-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "#6366f1",
                    boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
                  }}
                >
                  <BarChart2 size={20} color="white" />
                </div>
                <div>
                  <h1
                    className="text-xl font-bold tracking-tight"
                    style={{ color: "#0f172a" }}
                  >
                    Analytics Dashboard
                  </h1>
                  <p style={{ color: "#64748b", fontSize: 13 }}>
                    Thống kê dự án bất động sản
                  </p>
                </div>
              </div>

              {/* Time filter — hidden on overview tab */}
              {activeTab !== "overview" && (
                <div
                  className="flex items-center gap-1 rounded-xl p-1"
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTimeType(opt.value)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                      style={
                        timeType === opt.value
                          ? {
                              background: "#6366f1",
                              color: "#fff",
                              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
                            }
                          : { color: "#64748b" }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 mt-5 flex-wrap">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={
                      isActive
                        ? {
                            background: `${tab.activeColor}14`,
                            color: tab.activeColor,
                            border: `1px solid ${tab.activeColor}30`,
                          }
                        : {
                            color: "#64748b",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Page Content ── */}
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          {activeTab === "overview" && (
            <>
              {/* Existing stat cards — UNCHANGED */}
              <OverviewPanel stats={stats} />

              {/* === Added Analytics Section === */}
              <OverviewAnalyticsSection
                houses={stats.houses}
                lands={stats.lands}
              />
            </>
          )}
          {activeTab === "user" && <UserGrowthPage />}
          {activeTab === "post" && <PostAnalyticsPage />}
          {activeTab === "revenue" && <RevenueAnalyticsPage />}
          {activeTab === "appointment" && <AppointmentAnalyticsPage />}
          {activeTab === "behavior" && <BehaviorAnalyticsPage />}
          {activeTab === "employee" && <EmployeeAnalyticsPage />}
        </div>
      </div>
    </AnalyticsContext.Provider>
  );
};

export default DashboardPage;
