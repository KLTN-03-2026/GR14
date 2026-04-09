// src/pages/admin/analytics/post.tsx
import { useEffect, useState } from "react";
import { FileText, CheckCircle, XCircle, Clock, Star } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeType,
  TimeSeriesPoint,
  PostFunnelItem,
  ApprovalRate,
  VipActive,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDonutChart,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const FUNNEL_COLORS = ["#f59e0b", "#34d399", "#f43f5e"];

const TIME_LABEL: Record<TimeType, string> = {
  day: "ngày",
  month: "tháng",
  year: "năm",
};

// Map funnel items to donut chart format
function funnelToDonut(items: PostFunnelItem[]) {
  return items.map((f) => ({ name: f.label, value: f.total }));
}

export default function PostAnalyticsPage() {
  const { timeType } = useAnalyticsContext();

  const [postTime, setPostTime] = useState<TimeSeriesPoint[]>([]);
  const [funnel, setFunnel] = useState<{ name: string; value: number }[]>([]);
  const [approval, setApproval] = useState<ApprovalRate | null>(null);
  const [vipActive, setVipActive] = useState<VipActive | null>(null);
  const [vipGrowth, setVipGrowth] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getPostByTime(timeType),
      analyticsApi.getPostFunnel(),
      analyticsApi.getApprovalRate(),
      analyticsApi.getVipActive(),
      analyticsApi.getVipGrowth(timeType),
    ])
      .then(([timeData, funnelData, approvalData, vipData, vipGrowthData]) => {
        setPostTime(timeData);
        setFunnel(funnelToDonut(funnelData));
        setApproval(approvalData);
        setVipActive(vipData);
        setVipGrowth(vipGrowthData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const approvalPct = approval
    ? `${(approval.approvalRate * 100).toFixed(1)}%`
    : "…";

  const STATUS_SUMMARY = approval
    ? [
        { label: "Chờ duyệt", val: approval.pending, color: "#f59e0b" },
        { label: "Đã duyệt", val: approval.approved, color: "#10b981" },
        { label: "Từ chối", val: approval.rejected, color: "#f43f5e" },
      ]
    : [];

  const DETAIL_ITEMS = approval
    ? [
        {
          label: "Tổng bài đăng",
          value: approval.total,
          icon: <FileText size={16} />,
          color: "#64748b",
        },
        {
          label: "Tỷ lệ duyệt",
          value: approvalPct,
          icon: <CheckCircle size={16} />,
          color: "#10b981",
        },
        {
          label: "Chờ xử lý",
          value: approval.pending,
          icon: <Clock size={16} />,
          color: "#f59e0b",
        },
        {
          label: "Từ chối",
          value: approval.rejected,
          icon: <XCircle size={16} />,
          color: "#f43f5e",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tổng bài đăng"
          value={approval?.total.toLocaleString("vi-VN") ?? "…"}
          icon={<FileText size={18} />}
          accent="#3b82f6"
        />
        <KPICard
          title="Đã duyệt"
          value={approval?.approved.toLocaleString("vi-VN") ?? "…"}
          icon={<CheckCircle size={18} />}
          accent="#34d399"
        />
        <KPICard
          title="Tỷ lệ duyệt"
          value={approvalPct}
          icon={<Clock size={18} />}
          accent="#6366f1"
        />
        <KPICard
          title="VIP đang active"
          value={vipActive?.activeVip.toLocaleString("vi-VN") ?? "…"}
          icon={<Star size={18} />}
          accent="#f59e0b"
        />
      </div>

      {/* Posts over time */}
      <ChartCard
        title="Bài đăng mới theo thời gian"
        subtitle={`Từ bảng posts — theo ${TIME_LABEL[timeType]}`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : postTime.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsAreaChart
            data={postTime as unknown as Record<string, unknown>[]}
            dataKey="total"
            xKey="time"
            name="Bài đăng mới"
            color="#3b82f6"
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval funnel — Donut */}
        <ChartCard
          title="Funnel duyệt bài"
          subtitle="Tỷ lệ: Chờ duyệt / Đã duyệt / Từ chối"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : funnel.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AnalyticsDonutChart
                data={funnel}
                nameKey="name"
                valueKey="value"
                colors={FUNNEL_COLORS}
                height={220}
              />
              {STATUS_SUMMARY.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {STATUS_SUMMARY.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl p-3 text-center"
                      style={{
                        background: `${s.color}10`,
                        border: `1px solid ${s.color}25`,
                      }}
                    >
                      <p className="text-xs" style={{ color: s.color }}>
                        {s.label}
                      </p>
                      <p
                        className="text-lg font-bold mt-1"
                        style={{ color: "#0f172a" }}
                      >
                        {s.val.toLocaleString("vi-VN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ChartCard>

        {/* VIP growth — Bar */}
        <ChartCard
          title="Gói VIP mới theo thời gian"
          subtitle="Số subscription VIP được kích hoạt"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : vipGrowth.length === 0 ? (
            <EmptyState />
          ) : (
            <AnalyticsBarChart
              data={vipGrowth as unknown as Record<string, unknown>[]}
              bars={[{ key: "total", name: "VIP mới", color: "#f59e0b" }]}
              xKey="time"
              height={280}
            />
          )}
        </ChartCard>
      </div>

      {/* Approval rate detail */}
      {approval && (
        <ChartCard
          title="Tỷ lệ duyệt bài chi tiết"
          subtitle="Thống kê tổng hợp quá trình xét duyệt"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2">
            {DETAIL_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div style={{ color: item.color }}>{item.icon}</div>
                <div>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    {item.label}
                  </p>
                  <p className="text-lg font-bold" style={{ color: "#0f172a" }}>
                    {typeof item.value === "number"
                      ? item.value.toLocaleString("vi-VN")
                      : item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
