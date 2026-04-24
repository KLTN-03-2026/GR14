// src/components/analytics/EmployeeFilterBar.tsx
import { X, GitCompare, BarChart2, Lightbulb } from "lucide-react";
import type { EmployeePerformance } from "@/types/analytics";
import type { EmployeeProperty } from "@/hooks/useEmployeeAnalyticsData";

interface Props {
  performance: EmployeePerformance[];
  perfLoading: boolean;
  selectedEmployeeId: number | null;
  compareEmployeeId: number | null;
  setSelectedEmployeeId: (id: number | null) => void;
  setCompareEmployeeId: (id: number | null) => void;
  selectedEmployee: EmployeePerformance | null;
  selectedEmployeeProps: EmployeeProperty | null;
  isTopPerformer: boolean | null | undefined;
  displayName: (emp: EmployeePerformance | null | undefined) => string;
  insights: { text: string; positive: boolean }[];
  globalAvgAppointments: number;
  topPerformer: EmployeePerformance | undefined;
}

export const EmployeeFilterBar = ({
  performance,
  perfLoading,
  selectedEmployeeId,
  compareEmployeeId,
  setSelectedEmployeeId,
  setCompareEmployeeId,
  selectedEmployee,
  selectedEmployeeProps,
  isTopPerformer,
  displayName,
}: Props) => {
  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* ── Primary filter (unchanged) ── */}
        <div className="relative">
          <select
            value={selectedEmployeeId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              setSelectedEmployeeId(id);
              setCompareEmployeeId(null);
            }}
            className="appearance-none text-sm font-medium pl-3 pr-8 py-2 rounded-lg border cursor-pointer focus:outline-none focus:ring-2"
            style={{
              border: "1px solid #e2e8f0",
              color: selectedEmployeeId ? "#1e293b" : "#64748b",
              background: "#fff",
              boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            }}
            disabled={perfLoading && performance.length === 0}
          >
            <option value="">Tất cả nhân viên</option>
            {performance.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.fullName !== "N/A"
                  ? `${emp.fullName} (${emp.employeeCode})`
                  : emp.employeeCode}
              </option>
            ))}
          </select>
          {/* Chevron icon */}
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* ── Compare dropdown (unchanged) ── */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GitCompare size={14} style={{ color: "#10b981" }} />
            <span
              className="text-xs font-semibold"
              style={{ color: "#64748b" }}
            >
              So sánh với
            </span>
          </div>
          <div className="relative">
            <select
              value={compareEmployeeId ?? ""}
              onChange={(e) =>
                setCompareEmployeeId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="appearance-none text-sm font-medium pl-3 pr-8 py-2 rounded-lg border cursor-pointer focus:outline-none focus:ring-2"
              style={{
                border: compareEmployeeId
                  ? "1px solid #a7f3d0"
                  : "1px solid #e2e8f0",
                color: compareEmployeeId ? "#047857" : "#64748b",
                background: compareEmployeeId ? "#f0fdf4" : "#fff",
                boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
              }}
              disabled={perfLoading || selectedEmployeeId === null}
            >
              <option value="">— Chọn nhân viên để so sánh —</option>
              {performance
                .filter((emp) => emp.employeeId !== selectedEmployeeId)
                .map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.fullName !== "N/A"
                      ? `${emp.fullName} (${emp.employeeCode})`
                      : emp.employeeCode}
                  </option>
                ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Reset filter button (unchanged) */}
        {(selectedEmployeeId !== null || compareEmployeeId !== null) && (
          <button
            onClick={() => {
              setSelectedEmployeeId(null);
              setCompareEmployeeId(null);
            }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{
              background: "#fef2f2",
              color: "#ef4444",
              border: "1px solid #fecaca",
            }}
          >
            <X size={12} />
            Xoá bộ lọc
          </button>
        )}
      </div>

      {/* ── Enhanced filter status bar (only when employee is selected) ── */}
      {selectedEmployeeId !== null && selectedEmployee && (
        <div
          className="flex items-start gap-4 px-5 py-4 rounded-xl"
          style={{
            background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
            border: "1px solid #bfdbfe",
            boxShadow: "0 1px 4px rgba(14,165,233,0.08)",
          }}
        >
          {/* Avatar-like icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: "#0ea5e9", color: "#fff" }}
          >
            {displayName(selectedEmployee).charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#0369a1" }}>
              Đang xem thống kê của:{" "}
              <span style={{ color: "#0c4a6e" }}>
                {displayName(selectedEmployee)}
              </span>
              {isTopPerformer && (
                <span
                  className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#fef9c3", color: "#a16207" }}
                >
                  🏆 Xuất sắc nhất
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#7dd3fc" }}>
              Dữ liệu đang được lọc theo nhân viên này · Mã:{" "}
              <span
                className="font-mono font-semibold"
                style={{ color: "#0ea5e9" }}
              >
                {selectedEmployee.employeeCode}
              </span>
            </p>
          </div>

          {/* Quick stats in the status bar */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: "#0369a1" }}>
                {selectedEmployee.totalAppointments.toLocaleString("vi-VN")}
              </p>
              <p className="text-xs" style={{ color: "#7dd3fc" }}>
                Lịch hẹn
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: "#0369a1" }}>
                {(selectedEmployee.completionRate * 100).toFixed(0)}%
              </p>
              <p className="text-xs" style={{ color: "#7dd3fc" }}>
                Tỷ lệ chốt
              </p>
            </div>
            {selectedEmployeeProps && (
              <div className="text-center">
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#0369a1" }}
                >
                  {selectedEmployeeProps.total}
                </p>
                <p className="text-xs" style={{ color: "#7dd3fc" }}>
                  BĐS
                </p>
              </div>
            )}
            {/* Score quick stat in status bar */}
            {selectedEmployee.score !== undefined && (
              <div className="text-center">
                <p
                  className="text-xs font-semibold"
                  style={{
                    color:
                      (selectedEmployee.score ?? 0) >= 70
                        ? "#10b981"
                        : (selectedEmployee.score ?? 0) >= 40
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                >
                  {selectedEmployee.score?.toFixed(0)}
                </p>
                <p className="text-xs" style={{ color: "#7dd3fc" }}>
                  Điểm
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
