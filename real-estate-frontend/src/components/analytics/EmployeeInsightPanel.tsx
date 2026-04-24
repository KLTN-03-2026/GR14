// src/components/analytics/EmployeeInsightPanel.tsx
import { BarChart2, Lightbulb } from "lucide-react";
import type { EmployeePerformance } from "@/types/analytics";

interface Props {
  selectedEmployee: EmployeePerformance;
  globalAvgAppointments: number;
  topPerformer: EmployeePerformance | undefined;
  insights: { text: string; positive: boolean }[];
  displayName: (emp: EmployeePerformance | null | undefined) => string;
}

export const EmployeeInsightPanel = ({
  selectedEmployee,
  globalAvgAppointments,
  topPerformer,
  insights,
  displayName,
}: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Comparison block */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#6366f114", color: "#6366f1" }}
          >
            <BarChart2 size={15} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Hiệu suất so với hệ thống
            </h4>
            <p className="text-xs text-gray-400">So sánh với mức trung bình</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Selected employee bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-gray-600">
                {displayName(selectedEmployee)}
              </span>
              <span className="font-bold" style={{ color: "#0ea5e9" }}>
                {selectedEmployee.totalAppointments.toLocaleString("vi-VN")}{" "}
                lịch
              </span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: "#e5e7eb" }}
            >
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    topPerformer && topPerformer.totalAppointments > 0
                      ? (selectedEmployee.totalAppointments /
                          topPerformer.totalAppointments) *
                          100
                      : 0,
                  )}%`,
                  background: "#0ea5e9",
                }}
              />
            </div>
          </div>

          {/* System average bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-gray-400">
                Trung bình hệ thống
              </span>
              <span className="font-semibold text-gray-500">
                {globalAvgAppointments.toLocaleString("vi-VN")} lịch
              </span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: "#e5e7eb" }}
            >
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    topPerformer && topPerformer.totalAppointments > 0
                      ? (globalAvgAppointments /
                          topPerformer.totalAppointments) *
                          100
                      : 0,
                  )}%`,
                  background: "#cbd5e1",
                }}
              />
            </div>
          </div>
        </div>

        {/* FEATURE: Recommendation banner when employee is selected */}
        {selectedEmployee.recommendation && (
          <div
            className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <span className="text-sm mt-0.5">💡</span>
            <p className="text-xs font-medium" style={{ color: "#166534" }}>
              {selectedEmployee.recommendation}
            </p>
          </div>
        )}
      </div>

      {/* Insights block */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#f59e0b14", color: "#f59e0b" }}
          >
            <Lightbulb size={15} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Nhận xét tự động
            </h4>
            <p className="text-xs text-gray-400">Dựa trên dữ liệu thực</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {insights.map((ins, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: ins.positive ? "#f0fdf4" : "#fef2f2",
                color: ins.positive ? "#166534" : "#991b1b",
              }}
            >
              <span>{ins.positive ? "✅" : "⚠️"}</span>
              <span>{ins.text}</span>
            </div>
          ))}

          {/* FEATURE: Trend insight in the insight block */}
          {selectedEmployee.trend !== null &&
            selectedEmployee.trend !== undefined && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  background:
                    (selectedEmployee.trend ?? 0) >= 0 ? "#eff6ff" : "#fef2f2",
                  color:
                    (selectedEmployee.trend ?? 0) >= 0 ? "#1d4ed8" : "#991b1b",
                }}
              >
                <span>{(selectedEmployee.trend ?? 0) >= 0 ? "📈" : "📉"}</span>
                <span>
                  Xu hướng kỳ này:{" "}
                  {(selectedEmployee.trend ?? 0) > 0 ? "+" : ""}
                  {selectedEmployee.trend}% so với kỳ trước
                </span>
              </div>
            )}

          {insights.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">
              Chưa đủ dữ liệu để phân tích
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
