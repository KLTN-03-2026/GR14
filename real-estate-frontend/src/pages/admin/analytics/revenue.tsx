// src/pages/admin/analytics/revenue.tsx
import { useEffect, useState } from "react";
import { DollarSign, CreditCard, TrendingUp, Users } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeType,
  TimeSeriesPoint,
  SummaryKPI,
  GatewayRevenue,
  PackageRevenue,
  TopSpender,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDonutChart,
  HorizontalBar,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const GATEWAY_COLORS = ["#3b82f6", "#f43f5e", "#f59e0b", "#34d399"];
const PACKAGE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];

const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

export default function RevenueAnalyticsPage() {
  const { timeType } = useAnalyticsContext();

  const [summary, setSummary] = useState<SummaryKPI | null>(null);
  const [revenue, setRevenue] = useState<TimeSeriesPoint[]>([]);
  const [gateways, setGateways] = useState<GatewayRevenue[]>([]);
  const [packages, setPackages] = useState<PackageRevenue[]>([]);
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getSummary(),
      analyticsApi.getRevenue(timeType),
      analyticsApi.getRevenueByGateway(),
      analyticsApi.getRevenueByPackage(),
      analyticsApi.getTopSpenders(),
    ])
      .then(([sumData, revData, gwData, pkgData, spendersData]) => {
        setSummary(sumData);
        setRevenue(revData);
        setGateways(gwData);
        setPackages(pkgData);
        setTopSpenders(spendersData.slice(0, 10));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const maxPkgRevenue = Math.max(...packages.map((p) => p.total), 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Doanh thu tháng này"
          value={summary ? formatVND(summary.revenueThisMonth) : "…"}
          growth={summary?.revenueGrowth}
          icon={<DollarSign size={18} />}
          accent="#10b981"
        />
        <KPICard
          title="Tháng trước"
          value={summary ? formatVND(summary.revenueLastMonth) : "…"}
          icon={<TrendingUp size={18} />}
          accent="#34d399"
        />
        <KPICard
          title="Gói VIP active"
          value={packages
            .reduce((s, p) => s + p.count, 0)
            .toLocaleString("vi-VN")}
          icon={<CreditCard size={18} />}
          accent="#6366f1"
        />
        <KPICard
          title="Top spenders"
          value={topSpenders.length}
          icon={<Users size={18} />}
          accent="#f59e0b"
        />
      </div>

      {/* Revenue over time */}
      <ChartCard
        title="Doanh thu theo thời gian"
        subtitle={`Chỉ tính giao dịch thành công (status=1), nhóm theo ${timeType}`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : revenue.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsAreaChart
            data={revenue as unknown as Record<string, unknown>[]}
            dataKey="total"
            xKey="time"
            name="Doanh thu (VNĐ)"
            color="#10b981"
            formatter={formatVND}
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by gateway — Donut */}
        <ChartCard
          title="Doanh thu theo cổng thanh toán"
          subtitle="VNPay vs MoMo — chỉ tính giao dịch thành công"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : gateways.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AnalyticsDonutChart
                data={gateways.map((g) => ({
                  name: g.gateway.toUpperCase(),
                  value: g.revenue,
                }))}
                nameKey="name"
                valueKey="value"
                colors={GATEWAY_COLORS}
                height={200}
              />
              <div className="space-y-3 mt-4">
                {gateways.map((g, idx) => (
                  <div
                    key={g.gateway}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: "#ffffff" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background:
                            GATEWAY_COLORS[idx % GATEWAY_COLORS.length],
                        }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "#0f172a" }}
                      >
                        {g.gateway.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-sm font-bold"
                        style={{ color: "#0f172a" }}
                      >
                        {formatVND(g.revenue)}
                      </p>
                      <p className="text-xs" style={{ color: "#64748b" }}>
                        {g.transactions} giao dịch
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Revenue by package — Bar + HorizontalBar */}
        <ChartCard
          title="Doanh thu theo gói VIP"
          subtitle="Tổng doanh thu từng gói (7 / 14 / 30 ngày)"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : packages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AnalyticsBarChart
                data={packages.map((p) => ({ name: p.name, total: p.total }))}
                bars={[{ key: "total", name: "Doanh thu", color: "#6366f1" }]}
                xKey="name"
                height={200}
                formatter={formatVND}
              />
              <div className="space-y-2.5 mt-4">
                {packages.map((p, idx) => (
                  <HorizontalBar
                    key={p.name}
                    label={p.name}
                    value={p.total}
                    max={maxPkgRevenue}
                    color={PACKAGE_COLORS[idx % PACKAGE_COLORS.length]}
                  />
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Top 10 spenders — table */}
      <ChartCard
        title="Top 10 người chi tiêu nhiều nhất"
        subtitle="Tổng chi tiêu gói VIP — chỉ tính giao dịch thành công"
      >
        {loading ? (
          <ChartSkeleton height={200} />
        ) : topSpenders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["#", "Họ tên", "Email", "Tổng chi tiêu", "Giao dịch"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left pb-3 pr-4 font-medium"
                        style={{ color: "#64748b" }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {topSpenders.map((s) => (
                  <tr
                    key={s.userId}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td className="py-3 pr-4">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: s.rank <= 3 ? "#f59e0b33" : "#f1f5f9",
                          color: s.rank <= 3 ? "#f59e0b" : "#64748b",
                        }}
                      >
                        {s.rank}
                      </div>
                    </td>
                    <td className="py-3 pr-4" style={{ color: "#0f172a" }}>
                      {s.fullName}
                    </td>
                    <td className="py-3 pr-4" style={{ color: "#64748b" }}>
                      {s.email}
                    </td>
                    <td
                      className="py-3 pr-4 font-semibold"
                      style={{ color: "#10b981" }}
                    >
                      {formatVND(s.totalSpent)}
                    </td>
                    <td className="py-3" style={{ color: "#94a3b8" }}>
                      {s.transactions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
