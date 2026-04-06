// src/pages/admin/analytics/index.tsx
import { useState, createContext, useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  TrendingUp,
  FileText,
  DollarSign,
  Calendar,
  Heart,
  BarChart2,
} from "lucide-react";
import type { TimeType, AnalyticsContextValue } from "@/types/analytics";

// ─── Context ─────────────────────────────────────────────
export const AnalyticsContext = createContext<AnalyticsContextValue>({
  timeType: "month",
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

// ─── Config ──────────────────────────────────────────────
const TABS = [
  {
    path: "/admin/analytics/user-growth",
    label: "Người dùng",
    icon: TrendingUp,
    activeColor: "#8b5cf6",
  },
  {
    path: "/admin/analytics/post",
    label: "Bài đăng",
    icon: FileText,
    activeColor: "#3b82f6",
  },
  {
    path: "/admin/analytics/revenue",
    label: "Doanh thu",
    icon: DollarSign,
    activeColor: "#10b981",
  },
  {
    path: "/admin/analytics/appointment",
    label: "Lịch hẹn",
    icon: Calendar,
    activeColor: "#f59e0b",
  },
  {
    path: "/admin/analytics/behavior",
    label: "Hành vi",
    icon: Heart,
    activeColor: "#f43f5e",
  },
] as const;

const TIME_OPTIONS: { value: TimeType; label: string }[] = [
  { value: "day", label: "Theo ngày" },
  { value: "month", label: "Theo tháng" },
  { value: "year", label: "Theo năm" },
];

// ─── Component ───────────────────────────────────────────
export default function AnalyticsLayout() {
  const { pathname } = useLocation();
  const [timeType, setTimeType] = useState<TimeType>("month");

  return (
    <AnalyticsContext.Provider value={{ timeType }}>
      <div
        className="min-h-screen"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        {/* ── Top Bar ── */}
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-6 py-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    boxShadow: "0 0 20px rgba(99,102,241,0.4)",
                  }}
                >
                  <BarChart2 size={20} color="white" />
                </div>
                <div>
                  <h1
                    className="text-xl font-bold tracking-tight"
                    style={{ color: "#f1f5f9" }}
                  >
                    Analytics Dashboard
                  </h1>
                  <p style={{ color: "#64748b", fontSize: 13 }}>
                    Thống kê dự án bất động sản
                  </p>
                </div>
              </div>

              {/* Time filter */}
              <div
                className="flex items-center gap-1 rounded-xl p-1"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
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
                            background:
                              "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            color: "#fff",
                            boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
                          }
                        : { color: "#94a3b8" }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 mt-5 flex-wrap">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname.startsWith(tab.path);
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={
                      isActive
                        ? {
                            background: `${tab.activeColor}22`,
                            color: tab.activeColor,
                            border: `1px solid ${tab.activeColor}44`,
                          }
                        : {
                            color: "#64748b",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    <Icon size={15} />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Page Content ── */}
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Outlet context={{ timeType } satisfies { timeType: TimeType }} />
        </div>
      </div>
    </AnalyticsContext.Provider>
  );
}
