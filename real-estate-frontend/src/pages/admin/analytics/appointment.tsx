// src/pages/admin/analytics/appointment.tsx
import { useEffect, useState } from "react";
import { Calendar, CheckCircle, XCircle, Award } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeType,
  TimeSeriesPoint,
  AppointmentRates,
  EmployeePerformance,
  HeatmapPoint,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsDonutChart,
  HeatmapChart,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const TIME_LABEL: Record<TimeType, string> = {
  day: "ngày",
  month: "tháng",
  year: "năm",
};

const STATUS_COLORS = ["#f59e0b", "#34d399", "#f43f5e"];

function completionColor(rate: number): string {
  if (rate >= 0.7) return "#34d399";
  if (rate >= 0.4) return "#f59e0b";
  return "#f43f5e";
}

export default function AppointmentAnalyticsPage() {
  const { timeType } = useAnalyticsContext();

  const [apptTime, setApptTime] = useState<TimeSeriesPoint[]>([]);
  const [rates, setRates] = useState<AppointmentRates | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [performance, setPerformance] = useState<EmployeePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getAppointments(timeType),
      analyticsApi.getAppointmentRates(),
      analyticsApi.getHeatmap(),
      analyticsApi.getEmployeePerformance(),
    ])
      .then(([timeData, ratesData, heatData, perfData]) => {
        setApptTime(timeData);
        setRates(ratesData);
        setHeatmap(heatData);
        setPerformance(perfData.slice(0, 10));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const statusDonut = rates
    ? [
        { name: "Chờ duyệt", value: rates.pending },
        { name: "Đã duyệt", value: rates.approved },
        { name: "Từ chối", value: rates.rejected },
      ].filter((d) => d.value > 0)
    : [];

  const STATUS_SUMMARY = rates
    ? [
        { label: "Chờ duyệt", val: rates.pending, color: "#f59e0b" },
        { label: "Đã duyệt", val: rates.approved, color: "#10b981" },
        { label: "Từ chối", val: rates.rejected, color: "#f43f5e" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tổng lịch hẹn"
          value={rates?.total.toLocaleString("vi-VN") ?? "…"}
          icon={<Calendar size={18} />}
          accent="#f59e0b"
        />
        <KPICard
          title="Tỷ lệ duyệt"
          value={rates ? `${(rates.approvalRate * 100).toFixed(1)}%` : "…"}
          icon={<CheckCircle size={18} />}
          accent="#34d399"
        />
        <KPICard
          title="Tỷ lệ từ chối"
          value={rates ? `${(rates.rejectionRate * 100).toFixed(1)}%` : "…"}
          icon={<XCircle size={18} />}
          accent="#f43f5e"
        />
        <KPICard
          title="Tỷ lệ hoàn thành"
          value={rates ? `${(rates.completionRate * 100).toFixed(1)}%` : "…"}
          icon={<Award size={18} />}
          accent="#6366f1"
        />
      </div>

      {/* Appointments over time */}
      <ChartCard
        title="Lịch hẹn tạo mới theo thời gian"
        subtitle={`Nhóm theo ${TIME_LABEL[timeType]}`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : apptTime.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsAreaChart
            data={apptTime as unknown as Record<string, unknown>[]}
            dataKey="total"
            xKey="time"
            name="Lịch hẹn"
            color="#f59e0b"
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown — Donut */}
        <ChartCard
          title="Phân bổ trạng thái lịch hẹn"
          subtitle="Tỷ lệ: Chờ / Duyệt / Từ chối"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : statusDonut.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AnalyticsDonutChart
                data={statusDonut}
                nameKey="name"
                valueKey="value"
                colors={STATUS_COLORS}
                height={220}
              />
              {STATUS_SUMMARY.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {STATUS_SUMMARY.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: `${s.color}10` }}
                    >
                      <p className="text-xs" style={{ color: s.color }}>
                        {s.label}
                      </p>
                      <p
                        className="text-lg font-bold mt-1"
                        style={{ color: "#0f172a" }}
                      >
                        {s.val}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ChartCard>

        {/* Employee performance */}
        <ChartCard
          title="Hiệu suất nhân viên"
          subtitle="Tổng lịch hẹn và tỷ lệ hoàn thành thực tế (actualStatus)"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : performance.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {performance.map((emp) => {
                const color = completionColor(emp.completionRate);
                return (
                  <div
                    key={emp.employeeId}
                    className="rounded-xl p-3"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "#0f172a" }}
                        >
                          {emp.fullName}
                        </p>
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          {emp.employeeCode} · {emp.totalAppointments} lịch
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color }}>
                          {(emp.completionRate * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          {emp.completed} hoàn thành
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "#f1f5f9" }}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${emp.completionRate * 100}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Heatmap by hour */}
      <ChartCard
        title="Heatmap lịch hẹn theo giờ trong ngày"
        subtitle="Giờ nào có nhiều lịch hẹn nhất — đậm = nhiều lịch"
      >
        {loading ? (
          <ChartSkeleton height={100} />
        ) : heatmap.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="pt-2">
            <HeatmapChart data={heatmap} />
          </div>
        )}
      </ChartCard>
    </div>
  );
}
