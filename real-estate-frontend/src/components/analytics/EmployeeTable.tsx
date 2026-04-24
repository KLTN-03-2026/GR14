import {
  Eye,
  GitCompare,
  Award,
  SortAsc,
  Download,
  AlertCircle,
} from "lucide-react";

interface Props {
  sortedPerf: any[];
  perfLoading: boolean;
  propertyMap: Map<number, any>;
  selectedEmployeeId: number | null;
  compareEmployeeId: number | null;
  sortBy: any;
  setSortBy: any;
  performance: any[];
  exportPDF: () => void;
  exporting: boolean;
  exportExcel?: () => void;
}

export const EmployeeTable = (props: Props) => {
  const {
    sortedPerf,
    perfLoading,
    propertyMap,
    selectedEmployeeId,
    compareEmployeeId,
    sortBy,
    setSortBy,
    performance,
    exportPDF,
    exporting,
    exportExcel,
  } = props;

  function ScoreCell({ score }: { score: number | undefined }) {
    if (score === undefined)
      return <span className="text-gray-300 text-xs">—</span>;
    const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
    return (
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 w-12 rounded-full overflow-hidden"
          style={{ background: "#f1f5f9" }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(score, 100)}%`, background: color }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {score.toFixed(0)}
        </span>
      </div>
    );
  }
  //FEATURE: Activity status badge
  function ActivityBadge({
    status,
  }: {
    status: "active" | "idle" | "inactive" | undefined;
  }) {
    if (!status) return <span className="text-gray-300 text-xs">—</span>;
    const cfg = {
      active: {
        dot: "🟢",
        label: "Hoạt động",
        color: "#10b981",
        bg: "#d1fae5",
      },
      idle: { dot: "🟡", label: "Vắng", color: "#f59e0b", bg: "#fef3c7" },
      inactive: {
        dot: "🔴",
        label: "Không HĐ",
        color: "#ef4444",
        bg: "#fee2e2",
      },
    }[status];
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.dot} {cfg.label}
      </span>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className="bg-white rounded-xl shadow-sm p-6"
          style={{ border: "1px solid #e5e7eb" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-gray-800 font-semibold text-base">
                Bảng xếp hạng nhân viên
              </h3>
              <p className="text-gray-500 text-sm mt-0.5">
                Tỷ lệ chốt lịch hẹn & số lượng bất động sản phụ trách
              </p>
            </div>

            {/* FEATURE: Controls row — sort toggle + export PDF */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sort toggle */}
              <div
                className="flex items-center rounded-lg overflow-hidden"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <button
                  onClick={() => setSortBy("appointments")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: sortBy === "appointments" ? "#0ea5e9" : "#fff",
                    color: sortBy === "appointments" ? "#fff" : "#64748b",
                  }}
                >
                  <SortAsc size={11} />
                  Lịch hẹn
                </button>
                <button
                  onClick={() => setSortBy("score")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: sortBy === "score" ? "#6366f1" : "#fff",
                    color: sortBy === "score" ? "#fff" : "#64748b",
                  }}
                >
                  <Award size={11} />
                  Điểm
                </button>
              </div>

              {/* Employee count badge */}
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "#f59e0b14", color: "#f59e0b" }}
              >
                {performance.length} nhân viên
              </span>

              {/* NEW FEATURE: Export PDF button */}
              <button
                onClick={exportPDF}
                disabled={exporting || perfLoading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: exporting ? "#f1f5f9" : "#1e293b",
                  color: exporting ? "#94a3b8" : "#fff",
                  border: "1px solid transparent",
                }}
              >
                <Download size={12} />
                {exporting ? "Đang xuất..." : "Export PDF"}
              </button>
              {/* Export Excel button */}
              <button
                onClick={exportExcel}
                disabled={!exportExcel || perfLoading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "1px solid transparent",
                }}
              >
                <Download size={12} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Table */}
          {perfLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg animate-pulse"
                  style={{ background: "#f1f5f9" }}
                />
              ))}
            </div>
          ) : sortedPerf.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <AlertCircle size={24} style={{ color: "#94a3b8" }} />
              <p className="text-sm font-medium" style={{ color: "#64748b" }}>
                Nhân viên này chưa có dữ liệu
              </p>
              <p className="text-xs" style={{ color: "#cbd5e1" }}>
                Gợi ý: kiểm tra phân công hoặc hoạt động gần đây
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th colSpan={7}></th>

                    {/* phân tích */}
                    <th
                      colSpan={1}
                      className="text-center py-2 text-xs font-semibold tracking-wide"
                      style={{ color: "#94a3b8" }}
                    >
                      Phân tích
                    </th>
                    {(selectedEmployeeId !== null ||
                      compareEmployeeId !== null) && <th></th>}
                  </tr>

                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {[
                      "#",
                      "Nhân viên",
                      "Mã NV",
                      "Tổng lịch hẹn",
                      "Hoàn thành",
                      "Tỷ lệ chốt",
                      "BĐS phụ trách",
                      "Điểm",
                      "Trạng thái",
                      "Chi tiết",
                      ...(selectedEmployeeId !== null ||
                      compareEmployeeId !== null
                        ? [""]
                        : []),
                    ].map((h) => (
                      <th
                        key={h}
                        className="pb-3 pr-4 text-left font-semibold whitespace-nowrap"
                        style={{ color: "#94a3b8", fontSize: 12 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPerf.map((emp, idx) => {
                    const propData = propertyMap.get(emp.employeeId);
                    const ratePct = ((emp.completionRate ?? 0) * 100).toFixed(
                      0,
                    );
                    const rateColor =
                      emp.completionRate >= 0.7
                        ? "#10b981"
                        : emp.completionRate >= 0.4
                          ? "#f59e0b"
                          : "#ef4444";
                    const isSelected = emp.employeeId === selectedEmployeeId;
                    const isCompared = emp.employeeId === compareEmployeeId;

                    // NEW FEATURE: top-3 highlight works for both sort modes
                    // because idx is always based on the current sort order.
                    const isTop3 = idx < 3;

                    // Row background & border: selected=blue, compared=green, both can't coexist
                    const rowStyle: React.CSSProperties = {
                      borderBottom: "1px solid #f8fafc",

                      background: isSelected
                        ? "linear-gradient(90deg, #eff6ff, #f0f9ff)"
                        : isCompared
                          ? "linear-gradient(90deg, #f0fdf4, #ecfdf5)"
                          : idx === 0
                            ? "#fffbeb"
                            : idx === 1
                              ? "#f0fdf4"
                              : idx === 2
                                ? "#f8fafc"
                                : undefined,

                      borderLeft: isSelected
                        ? "3px solid #0ea5e9"
                        : isCompared
                          ? "3px solid #10b981"
                          : idx === 0
                            ? "3px solid #f59e0b"
                            : idx === 1
                              ? "3px solid #10b981"
                              : idx === 2
                                ? "3px solid #94a3b8"
                                : "3px solid transparent",
                    };

                    return (
                      <tr
                        key={emp.employeeId}
                        style={rowStyle}
                        className="hover:bg-slate-100 transition-all duration-150"
                      >
                        {/* Rank — NEW FEATURE: top-3 badge works for score sort too */}
                        <td className="py-3 pr-4">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={
                              isTop3
                                ? {
                                    background: "#f59e0b18",
                                    color: "#f59e0b",
                                  }
                                : { background: "#f1f5f9", color: "#94a3b8" }
                            }
                          >
                            {idx + 1}
                          </span>
                        </td>
                        {/* Name */}
                        <td className="py-3 pr-4 font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span>{emp.fullName}</span>
                            {/* NEW FEATURE: crown for idx=0 (top by current sort) */}
                            {idx === 0 && <span title="Hàng đầu">👑</span>}
                          </div>
                        </td>
                        {/* Code */}
                        <td className="py-3 pr-4">
                          <span
                            className="text-xs px-2 py-0.5 rounded font-mono"
                            style={{
                              background: "#f1f5f9",
                              color: "#64748b",
                            }}
                          >
                            {emp.employeeCode}
                          </span>
                        </td>
                        {/* Total */}
                        <td className="py-3 pr-4 font-semibold text-gray-800">
                          {emp.totalAppointments.toLocaleString("vi-VN")}
                        </td>
                        {/* Completed */}
                        <td className="py-3 pr-4 text-gray-600">
                          {emp.completed.toLocaleString("vi-VN")}
                        </td>
                        {/* Rate */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-16 rounded-full overflow-hidden"
                              style={{ background: "#e5e7eb" }}
                            >
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${ratePct}%`,
                                  background: rateColor,
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: rateColor }}
                            >
                              {ratePct}%
                            </span>
                          </div>
                        </td>
                        {/* Properties */}
                        <td className="py-3 pr-4">
                          {propData ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  background: "#6366f114",
                                  color: "#6366f1",
                                }}
                              >
                                {propData.houses} nhà
                              </span>
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  background: "#10b98114",
                                  color: "#10b981",
                                }}
                              >
                                {propData.lands} đất
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        {/* ── NEW FEATURE: Score ── */}
                        <td className="py-3 pr-4">
                          <ScoreCell score={emp.score} />
                        </td>

                        {/* ── NEW FEATURE: Activity status ── */}
                        <td className="py-3 pr-4 text-center">
                          <ActivityBadge status={emp.activityStatus} />
                        </td>

                        {/* ── NEW FEATURE: Trend ── */}
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {/* Trend */}
                            {emp.trend !== null && emp.trend !== undefined && (
                              <span
                                className="px-2 py-0.5 rounded"
                                style={{
                                  background:
                                    emp.trend > 0 ? "#dcfce7" : "#fee2e2",
                                  color: emp.trend > 0 ? "#15803d" : "#dc2626",
                                }}
                              >
                                {emp.trend > 0 ? "📈 +" : "📉 "}
                                {emp.trend}%
                              </span>
                            )}

                            {/* Strength */}
                            {emp.strength === "house" && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                🏠 Mạnh nhà
                              </span>
                            )}
                            {emp.strength === "land" && (
                              <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">
                                🌱 Mạnh đất
                              </span>
                            )}
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex flex-wrap gap-2">
                                {/* alert */}
                                {emp.alerts?.includes("no_activity") && (
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    😴 Không hoạt động
                                  </span>
                                )}
                                {emp.alerts?.includes("low_performance") && (
                                  <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">
                                    ⚠️ Hiệu suất thấp
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {/* recommendation */}
                                {emp.recommendation && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    💡 {emp.recommendation}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Empty */}
                            {!emp.alerts?.length &&
                              !emp.recommendation &&
                              emp.trend == null &&
                              (!emp.strength || emp.strength === "neutral") && (
                                <span className="text-gray-400">—</span>
                              )}
                          </div>
                        </td>

                        {/* Status badge column — visible when any filter is active */}
                        {(selectedEmployeeId !== null ||
                          compareEmployeeId !== null) && (
                          <td className="py-3 pr-2">
                            {isSelected && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{
                                  background: "#dbeafe",
                                  color: "#1d4ed8",
                                }}
                              >
                                <Eye size={10} />
                                Đang xem
                              </span>
                            )}
                            {isCompared && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{
                                  background: "#dcfce7",
                                  color: "#15803d",
                                }}
                              >
                                <GitCompare size={10} />
                                So sánh
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
