// src/pages/admin/analytics/user-growth.tsx
import { useEffect, useState } from "react";
import { Users, UserCheck, Activity, RefreshCw } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeType,
  TimeSeriesPoint,
  DAUPoint,
  MAUPoint,
  RetentionResult,
  SummaryKPI,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsBarChart,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const TIME_LABEL: Record<TimeType, string> = {
  day: "ngày",
  month: "tháng",
  year: "năm",
};

export default function UserGrowthPage() {
  const { timeType } = useAnalyticsContext();

  const [summary, setSummary] = useState<SummaryKPI | null>(null);
  const [growth, setGrowth] = useState<TimeSeriesPoint[]>([]);
  const [dau, setDau] = useState<DAUPoint[]>([]);
  const [mau, setMau] = useState<MAUPoint[]>([]);
  const [retention, setRetention] = useState<{
    d1: RetentionResult | null;
    d7: RetentionResult | null;
    d30: RetentionResult | null;
  }>({ d1: null, d7: null, d30: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getSummary(),
      analyticsApi.getUserGrowth(timeType),
      analyticsApi.getDAU(),
      analyticsApi.getMAU(),
      analyticsApi.getRetention(1),
      analyticsApi.getRetention(7),
      analyticsApi.getRetention(30),
    ])
      .then(([sumData, growthData, dauData, mauData, r1, r7, r30]) => {
        setSummary(sumData);
        setGrowth(growthData);
        setDau(dauData.slice(-30)); // Last 30 days
        setMau(mauData);
        setRetention({ d1: r1, d7: r7, d30: r30 });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const fmtPct = (r: RetentionResult | null) =>
    r ? `${(r.rate * 100).toFixed(1)}%` : "—";

  const RETENTION_ROWS = [
    { label: "D1 — Hôm sau", data: retention.d1, color: "#10b981" },
    { label: "D7 — Tuần sau", data: retention.d7, color: "#6366f1" },
    { label: "D30 — Tháng sau", data: retention.d30, color: "#f59e0b" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tổng người dùng"
          value={summary?.totalUsers.toLocaleString("vi-VN") ?? "…"}
          growth={summary?.userGrowth}
          icon={<Users size={18} />}
          accent="#6366f1"
        />
        <KPICard
          title="Mới tháng này"
          value={summary?.newUsersThisMonth.toLocaleString("vi-VN") ?? "…"}
          icon={<UserCheck size={18} />}
          accent="#8b5cf6"
        />
        <KPICard
          title="Retention D7"
          value={fmtPct(retention.d7)}
          icon={<RefreshCw size={18} />}
          accent="#a855f7"
        />
        <KPICard
          title="Retention D30"
          value={fmtPct(retention.d30)}
          icon={<Activity size={18} />}
          accent="#d946ef"
        />
      </div>

      {/* User growth area chart */}
      <ChartCard
        title="Tăng trưởng người dùng mới"
        subtitle={`Số user đăng ký mới theo ${TIME_LABEL[timeType]}`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : growth.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsAreaChart
            data={growth as unknown as Record<string, unknown>[]}
            dataKey="total"
            xKey="time"
            name="User mới"
            color="#6366f1"
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DAU */}
        <ChartCard
          title="DAU — Người dùng hoạt động theo ngày"
          subtitle="Dựa trên lượt xem, click, lưu tin (user_behaviors)"
        >
          {loading ? (
            <ChartSkeleton height={240} />
          ) : dau.length === 0 ? (
            <EmptyState />
          ) : (
            <AnalyticsBarChart
              data={dau as unknown as Record<string, unknown>[]}
              bars={[{ key: "total", name: "Active Users", color: "#8b5cf6" }]}
              xKey="date"
              height={240}
            />
          )}
        </ChartCard>

        {/* MAU */}
        <ChartCard
          title="MAU — Người dùng hoạt động theo tháng"
          subtitle="Unique users có tương tác mỗi tháng"
        >
          {loading ? (
            <ChartSkeleton height={240} />
          ) : mau.length === 0 ? (
            <EmptyState />
          ) : (
            <AnalyticsAreaChart
              data={mau as unknown as Record<string, unknown>[]}
              dataKey="total"
              xKey="month"
              name="MAU"
              color="#a855f7"
              height={240}
            />
          )}
        </ChartCard>
      </div>

      {/* Retention cards */}
      <ChartCard
        title="Tỷ lệ quay lại (Retention)"
        subtitle="Phần trăm user quay lại sau N ngày kể từ khi đăng ký"
      >
        <div className="grid grid-cols-3 gap-4 py-4">
          {RETENTION_ROWS.map((r) => (
            <div
              key={r.label}
              className="rounded-xl p-5 text-center"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
              }}
            >
              <p
                className="text-xs uppercase tracking-wider mb-3"
                style={{ color: "#64748b" }}
              >
                {r.label}
              </p>
              <p className="text-3xl font-bold" style={{ color: r.color }}>
                {fmtPct(r.data)}
              </p>
              {r.data && (
                <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>
                  {r.data.retained} / {r.data.total} users
                </p>
              )}
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
