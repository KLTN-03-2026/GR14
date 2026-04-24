import { useEmployeeAnalyticsTrend } from "@/hooks/useEmployeeAnalyticsTrend";
import type { TimeType } from "@/types/analytics";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LineChart,
  Line,
} from "recharts";

import {
  ChartCard,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";
interface Props {
  perfLoading: boolean;
  propLoading: boolean;
  top10Perf: any[];
  top10Props: any[];
  selectedEmployeeId: number | null;
  compareEmployeeId: number | null;
  CustomTooltip: any;
  timeType: TimeType;
}
export const EmployeeChartSection = ({
  perfLoading,
  propLoading,
  top10Perf,
  top10Props,
  selectedEmployeeId,
  compareEmployeeId,
  CustomTooltip,
  timeType,
}: Props) => {
  const { trendData, trendLoading } = useEmployeeAnalyticsTrend(timeType);
  return (
    <>
      <div className="mb-6">
        <ChartCard title="Xu hướng lịch hẹn" subtitle="Theo thời gian">
          {trendLoading ? (
            <ChartSkeleton height={260} />
          ) : trendData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="totalAppointments"
                  name="Tổng lịch hẹn"
                  stroke="#6366f1"
                  strokeWidth={2}
                />

                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Hoàn thành"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Performance bar chart */}
        <ChartCard
          title="Top 10 nhân viên theo lịch hẹn"
          subtitle="Tổng và hoàn thành thực tế"
        >
          {perfLoading ? (
            <ChartSkeleton height={260} />
          ) : top10Perf.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={top10Perf}
                margin={{ top: 5, right: 5, bottom: 60, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                />
                <Bar
                  dataKey="Tổng lịch hẹn"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                >
                  {top10Perf.map((entry) => (
                    <Cell
                      key={entry.employeeId}
                      fill={
                        entry.employeeId === selectedEmployeeId
                          ? "#0ea5e9"
                          : entry.employeeId === compareEmployeeId
                            ? "#10b981"
                            : "#6366f1"
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="Hoàn thành"
                  fill="#34d399"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Properties bar chart */}
        <ChartCard
          title="Top 10 nhân viên theo BĐS"
          subtitle="Số nhà và đất đang phụ trách"
        >
          {propLoading ? (
            <ChartSkeleton height={260} />
          ) : top10Props.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={top10Props}
                margin={{ top: 5, right: 5, bottom: 60, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                />
                <Bar dataKey="Nhà" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {top10Props.map((entry) => (
                    <Cell
                      key={entry.employeeId}
                      fill={
                        entry.employeeId === selectedEmployeeId
                          ? "#0ea5e9"
                          : entry.employeeId === compareEmployeeId
                            ? "#10b981"
                            : "#6366f1"
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="Đất" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </>
  );
};
