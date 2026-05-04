// src/pages/admin/analytics/revenue.tsx
// Vai trò: "Nhìn nhanh" — phân tích trend, gateway breakdown, top spenders
// Chi tiết giao dịch → /admin/revenue (Quản lý doanh thu)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, Users, ArrowRight } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeSeriesPoint,
  SummaryKPI,
  GatewayRevenue,
  TopSpender,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsDonutChart,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const GATEWAY_COLORS = ["#3b82f6", "#f43f5e", "#f59e0b", "#34d399"];

const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

export default function RevenueAnalyticsPage() {
  const { timeType } = useAnalyticsContext();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<SummaryKPI | null>(null);
  const [revenue, setRevenue] = useState<TimeSeriesPoint[]>([]);
  const [gateways, setGateways] = useState<GatewayRevenue[]>([]);
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getSummary(),
      analyticsApi.getRevenue(timeType),
      analyticsApi.getRevenueByGateway(),
      analyticsApi.getTopSpenders(),
    ])
      .then(([sumData, revData, gwData, spendersData]) => {
        setSummary(sumData);
        setRevenue(revData);
        setGateways(gwData);
        setTopSpenders(spendersData.slice(0, 10));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  return (
    <div className="space-y-6">
      {/* ── KPI tháng hiện tại ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
          title="Top spenders"
          value={topSpenders.length}
          icon={<Users size={18} />}
          accent="#f59e0b"
        />
      </div>

      {/* ── Biểu đồ doanh thu theo thời gian ──────────────────────────────── */}
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

      {/* ── Cổng thanh toán (Donut) ─────────────────────────────────────────── */}
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
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: GATEWAY_COLORS[idx % GATEWAY_COLORS.length],
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
                    <p className="text-sm font-bold" style={{ color: "#0f172a" }}>
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

      {/* ── Top 10 spenders ────────────────────────────────────────────────── */}
      <ChartCard
        title="Top 10 người chi tiêu nhiều nhất"
        subtitle="Tổng chi tiêu — chỉ tính giao dịch thành công"
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
                    )
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

      {/* ── Banner CTA → Quản lý doanh thu ────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-6 py-5"
        style={{
          background: "linear-gradient(135deg, #10b98112 0%, #6366f10a 100%)",
          border: "1px solid #10b98128",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#10b98120" }}
          >
            <DollarSign size={20} style={{ color: "#10b981" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>
              Cần xem chi tiết từng giao dịch?
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
              Trang Quản lý doanh thu có bảng giao dịch đầy đủ, bộ lọc nâng
              cao (VIP / Đặt cọc / phương thức), phân trang và xuất CSV.
            </p>
          </div>
        </div>
        <button
          id="btn-goto-revenue-management"
          onClick={() => navigate("/admin/revenue")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex-shrink-0 ml-6 hover:opacity-90 active:scale-95"
          style={{
            background: "#10b981",
            color: "#fff",
            boxShadow: "0 2px 10px rgba(16,185,129,0.35)",
          }}
        >
          Xem chi tiết giao dịch
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
