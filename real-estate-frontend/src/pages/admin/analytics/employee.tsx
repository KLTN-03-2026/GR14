// src/pages/admin/analytics/employee.tsx
import { useMemo } from "react";
import { useEffect, useState } from "react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import {
  ChartSkeleton,
  EmptyState,
  KPICard,
  ChartCard,
} from "@/components/analytics/charts";
import {
  Users,
  Calendar,
  TrendingUp,
  Award,
  Home,
  Map,
  X,
  Eye,
  BarChart2,
  Lightbulb,
  AlertCircle,
  GitCompare,
} from "lucide-react";
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
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeePerformance {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  totalAppointments: number;
  completed: number;
  completionRate: number;
}

interface EmployeeProperty {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  houses: number;
  lands: number;
  total: number;
}

interface ComparisonMetric {
  label: string;
  valueA: number;
  valueB: number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

// ─── Custom tooltip for recharts (matches existing ChartTooltip style) ────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-lg"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        color: "#0f172a",
      }}
    >
      <p className="font-medium mb-2" style={{ color: "#64748b" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: "#64748b" }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: "#0f172a" }}>
            {entry.value.toLocaleString("vi-VN")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section label component ──────────────────────────────────────────────────

function SectionLabel({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-3"
      style={{ background: bg, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

// ─── Comparison metric row ────────────────────────────────────────────────────

function CompareMetricRow({ metric }: { metric: ComparisonMetric }) {
  const { label, valueA, valueB, format, higherIsBetter } = metric;
  const maxValue = Math.max(valueA, valueB, 1);
  const pctA = (valueA / maxValue) * 100;
  const pctB = (valueB / maxValue) * 100;

  const aWins = higherIsBetter ? valueA > valueB : valueA < valueB;
  const bWins = higherIsBetter ? valueB > valueA : valueB < valueA;
  const tied = valueA === valueB;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}
    >
      {/* Metric label */}
      <p
        className="text-xs font-semibold text-center mb-3"
        style={{ color: "#64748b" }}
      >
        {label}
      </p>

      {/* A row */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs mb-1">
          <div className="flex items-center gap-1">
            <span
              className="w-4 h-4 rounded flex items-center justify-center text-white font-bold"
              style={{ background: "#0ea5e9", fontSize: 9 }}
            >
              A
            </span>
            <span className="font-medium" style={{ color: "#0369a1" }}>
              {format(valueA)}
            </span>
          </div>
          {aWins && !tied && (
            <span className="text-xs" style={{ color: "#f59e0b" }}>
              🏆
            </span>
          )}
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "#e5e7eb" }}
        >
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{
              width: `${pctA}%`,
              background: aWins ? "#0ea5e9" : tied ? "#0ea5e9" : "#93c5fd",
            }}
          />
        </div>
      </div>

      {/* B row */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1">
          <div className="flex items-center gap-1">
            <span
              className="w-4 h-4 rounded flex items-center justify-center text-white font-bold"
              style={{ background: "#10b981", fontSize: 9 }}
            >
              B
            </span>
            <span className="font-medium" style={{ color: "#047857" }}>
              {format(valueB)}
            </span>
          </div>
          {bWins && !tied && (
            <span className="text-xs" style={{ color: "#f59e0b" }}>
              🏆
            </span>
          )}
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "#e5e7eb" }}
        >
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{
              width: `${pctB}%`,
              background: bWins ? "#10b981" : tied ? "#10b981" : "#6ee7b7",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Employee Analytics Page ───────────────────────────────────────────────────

const EmployeeAnalyticsPage: React.FC = () => {
  // ── Sync with global time filter from DashboardPage context ──
  const { timeType } = useAnalyticsContext();

  // ── Filter state ──
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [compareEmployeeId, setCompareEmployeeId] = useState<number | null>(
    null,
  );

  // ── Performance state ──
  const [performance, setPerformance] = useState<EmployeePerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);

  // ── Properties state ──
  const [properties, setProperties] = useState<EmployeeProperty[]>([]);
  const [propLoading, setPropLoading] = useState(true);
  const propertyMap = useMemo(() => {
    const map: Map<number, EmployeeProperty> = new globalThis.Map();
    properties.forEach((p) => map.set(p.employeeId, p));
    return map;
  }, [properties]);
  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    setPerfLoading(true);
    setPerformance([]);

    analyticsApi
      .getEmployeePerformance(timeType)
      .then((data) => {
        if (isMounted) setPerformance(data ?? []);
      })
      .catch(() => {
        if (isMounted) setPerformance([]);
      })
      .finally(() => {
        if (isMounted) setPerfLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeType]);
  useEffect(() => {
    setCompareEmployeeId(null);
  }, [timeType]);

  useEffect(() => {
    let isMounted = true;

    setPropLoading(true);

    analyticsApi
      .getEmployeeProperties()
      .then((data) => {
        if (isMounted) setProperties(data ?? []);
      })
      .catch(() => {
        if (isMounted) setProperties([]);
      })
      .finally(() => {
        if (isMounted) setPropLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeType]);

  // ── Filtered datasets ──────────────────────────────────────────────────────

  const filteredPerf = selectedEmployeeId
    ? performance.filter((e) => e.employeeId === selectedEmployeeId)
    : performance;

  const filteredProps = selectedEmployeeId
    ? properties.filter((e) => e.employeeId === selectedEmployeeId)
    : properties;

  // ── Selected employee lookup ───────────────────────────────────────────────

  const selectedEmployee = selectedEmployeeId
    ? (performance.find((e) => e.employeeId === selectedEmployeeId) ?? null)
    : null;

  useEffect(() => {
    if (selectedEmployeeId && !selectedEmployee) {
      setSelectedEmployeeId(null);
    }
  }, [performance, selectedEmployeeId, selectedEmployee]);

  const selectedEmployeeProps = selectedEmployeeId
    ? (propertyMap.get(selectedEmployeeId) ?? null)
    : null;

  // ── Compare employee lookup ────────────────────────────────────────────────

  const compareEmployee = compareEmployeeId
    ? (performance.find((e) => e.employeeId === compareEmployeeId) ?? null)
    : null;

  const compareEmployeeProps = compareEmployeeId
    ? (propertyMap.get(compareEmployeeId) ?? null)
    : null;

  // Reset compareEmployeeId if employee no longer exists in data
  useEffect(() => {
    if (compareEmployeeId && !compareEmployee) {
      setCompareEmployeeId(null);
    }
  }, [performance, compareEmployeeId, compareEmployee]);

  // ── GLOBAL KPIs (always from full dataset, never filtered) ─────────────────

  const globalTotalEmployees = performance.length;
  const globalTotalAppointments = performance.reduce(
    (s, e) => s + e.totalAppointments,
    0,
  );
  const globalAvgAppointments =
    globalTotalEmployees > 0
      ? +(globalTotalAppointments / globalTotalEmployees).toFixed(1)
      : 0;

  // Top performer always from full dataset — sort once and reuse
  const perfSortedByAppt = useMemo(() => {
    return [...performance].sort(
      (a, b) => b.totalAppointments - a.totalAppointments,
    );
  }, [performance]);
  const topPerformer = perfSortedByAppt[0];

  // ── FILTERED KPIs (scoped to selected employee when active) ────────────────

  const filteredTotalAppointments = filteredPerf.reduce(
    (s, e) => s + e.totalAppointments,
    0,
  );
  const filteredAvgAppointments =
    filteredPerf.length > 0
      ? +(filteredTotalAppointments / filteredPerf.length).toFixed(1)
      : 0;
  const filteredTotalProperties = filteredProps.reduce(
    (s, p) => s + p.total,
    0,
  );

  // ── Chart data ─────────────────────────────────────────────────────────────

  const top10PerfSource = perfSortedByAppt.slice(0, 10);

  const isSelectedInTop10 = selectedEmployeeId
    ? top10PerfSource.some((e) => e.employeeId === selectedEmployeeId)
    : true;
  const perfChartSource =
    selectedEmployeeId && !isSelectedInTop10 && selectedEmployee
      ? [...top10PerfSource.slice(0, 9), selectedEmployee]
      : top10PerfSource;

  const top10Perf = perfChartSource.map((e) => {
    const lastName =
      e.fullName !== "N/A"
        ? e.fullName.split(" ").slice(-1)[0]
        : e.employeeCode;

    return {
      name: `${lastName} (${e.employeeCode})`,
      fullName: e.fullName,
      employeeId: e.employeeId,
      "Tổng lịch hẹn": e.totalAppointments,
      "Hoàn thành": e.completed,
    };
  });

  const sortedProps = useMemo(() => {
    return [...properties].sort((a, b) => b.total - a.total);
  }, [properties]);
  const top10PropsBase = sortedProps.slice(0, 10);

  const isSelectedInTop10Props = selectedEmployeeId
    ? top10PropsBase.some((p) => p.employeeId === selectedEmployeeId)
    : true;

  const top10Props = (
    selectedEmployeeId && !isSelectedInTop10Props && selectedEmployeeProps
      ? [...top10PropsBase.slice(0, 9), selectedEmployeeProps]
      : top10PropsBase
  ).map((e) => {
    const lastName =
      e.fullName !== "N/A"
        ? e.fullName.split(" ").slice(-1)[0]
        : e.employeeCode;

    return {
      name: `${lastName} (${e.employeeCode})`,
      fullName: e.fullName,
      employeeId: e.employeeId,
      Nhà: e.houses,
      Đất: e.lands,
    };
  });

  // ── Comparison & insight derivations ──────────────────────────────────────

  const isTopPerformer =
    selectedEmployee &&
    topPerformer &&
    selectedEmployee.employeeId === topPerformer.employeeId;

  const vsAvgDiff =
    selectedEmployee && globalAvgAppointments > 0
      ? selectedEmployee.totalAppointments - globalAvgAppointments
      : 0;

  const vsAvgPct =
    globalAvgAppointments > 0
      ? +((vsAvgDiff / globalAvgAppointments) * 100).toFixed(1)
      : 0;

  // Insights: simple rule-based messages
  const insights: { text: string; positive: boolean }[] = [];
  if (selectedEmployee) {
    if (vsAvgDiff > 0) {
      insights.push({
        text: `Hiệu suất cao hơn trung bình hệ thống ${vsAvgPct}%`,
        positive: true,
      });
    } else if (vsAvgDiff < 0) {
      insights.push({
        text: `Hiệu suất thấp hơn trung bình hệ thống ${Math.abs(vsAvgPct)}%`,
        positive: false,
      });
    } else {
      insights.push({
        text: "Hiệu suất đúng bằng mức trung bình hệ thống",
        positive: true,
      });
    }

    if (selectedEmployee.completionRate >= 0.7) {
      insights.push({ text: "Tỷ lệ hoàn thành tốt (≥ 70%)", positive: true });
    } else if (selectedEmployee.completionRate >= 0.4) {
      insights.push({
        text: "Tỷ lệ hoàn thành ở mức trung bình (40–70%)",
        positive: false,
      });
    } else {
      insights.push({
        text: "Tỷ lệ hoàn thành thấp hơn mức tốt (< 40%)",
        positive: false,
      });
    }

    if (isTopPerformer) {
      insights.push({
        text: "Nhân viên xuất sắc nhất toàn hệ thống 🏆",
        positive: true,
      });
    }
  }

  // Helper to display name
  const displayName = (emp: EmployeePerformance | null | undefined) =>
    emp ? (emp.fullName !== "N/A" ? emp.fullName : emp.employeeCode) : "—";

  // ── 2-Employee Comparison derivations ─────────────────────────────────────

  const showComparison =
    selectedEmployeeId !== null &&
    compareEmployeeId !== null &&
    selectedEmployee !== null &&
    compareEmployee !== null;

  const comparisonMetrics: ComparisonMetric[] =
    showComparison && selectedEmployee && compareEmployee
      ? [
          {
            label: "Tổng lịch hẹn",
            valueA: selectedEmployee.totalAppointments,
            valueB: compareEmployee.totalAppointments,
            format: (v: number) => v.toLocaleString("vi-VN"),
            higherIsBetter: true,
          },
          {
            label: "Hoàn thành",
            valueA: selectedEmployee.completed,
            valueB: compareEmployee.completed,
            format: (v: number) => v.toLocaleString("vi-VN"),
            higherIsBetter: true,
          },
          {
            label: "Tỷ lệ hoàn thành",
            valueA: +((selectedEmployee.completionRate ?? 0) * 100).toFixed(1),
            valueB: +((compareEmployee.completionRate ?? 0) * 100).toFixed(1),
            format: (v: number) => `${v}%`,
            higherIsBetter: true,
          },
          {
            label: "Tổng BĐS",
            valueA: selectedEmployeeProps?.total ?? 0,
            valueB: compareEmployeeProps?.total ?? 0,
            format: (v: number) => v.toLocaleString("vi-VN"),
            higherIsBetter: true,
          },
          {
            label: "Nhà",
            valueA: selectedEmployeeProps?.houses ?? 0,
            valueB: compareEmployeeProps?.houses ?? 0,
            format: (v: number) => v.toLocaleString("vi-VN"),
            higherIsBetter: true,
          },
          {
            label: "Đất",
            valueA: selectedEmployeeProps?.lands ?? 0,
            valueB: compareEmployeeProps?.lands ?? 0,
            format: (v: number) => v.toLocaleString("vi-VN"),
            higherIsBetter: true,
          },
        ]
      : [];

  // Auto-generated comparison insights (max 3)
  const comparisonInsights: string[] = [];
  if (showComparison && selectedEmployee && compareEmployee) {
    const nameA = displayName(selectedEmployee);
    const nameB = displayName(compareEmployee);

    const apptA = selectedEmployee.totalAppointments;
    const apptB = compareEmployee.totalAppointments;
    if (apptA !== apptB) {
      const winner = apptA > apptB ? nameA : nameB;
      const diff = Math.abs(apptA - apptB);
      const base = Math.min(apptA, apptB);
      const pct = base > 0 ? Math.round((diff / base) * 100) : 100;
      comparisonInsights.push(
        `${winner} xử lý nhiều hơn ${diff.toLocaleString("vi-VN")} lịch hẹn (+${pct}%)`,
      );
    }

    const rateA = selectedEmployee.completionRate;
    const rateB = compareEmployee.completionRate;
    if (Math.abs(rateA - rateB) > 0.005) {
      const winner = rateA > rateB ? nameA : nameB;
      const diff = (Math.abs(rateA - rateB) * 100).toFixed(1);
      comparisonInsights.push(
        `${winner} có tỷ lệ hoàn thành tốt hơn (+${diff}%)`,
      );
    }

    const maxAppt = Math.max(apptA, apptB, 1);
    const minAppt = Math.min(apptA, apptB);
    const gapPct = ((maxAppt - minAppt) / maxAppt) * 100;
    if (gapPct > 30) {
      comparisonInsights.push("⚠ Chênh lệch hiệu suất lớn giữa hai nhân viên");
    }
  }
  const compareInsightsToShow = comparisonInsights.slice(0, 3);

  // ── Table source: show all rows when both filters are active so both
  //    employees can be highlighted; otherwise keep original filtered behavior ──
  const tablePerfSource =
    selectedEmployeeId !== null && compareEmployeeId !== null
      ? performance
      : filteredPerf;

  const sortedPerf = useMemo(() => {
    return [...tablePerfSource].sort(
      (a, b) => b.totalAppointments - a.totalAppointments,
    );
  }, [tablePerfSource]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — KPI CARDS (split into global vs filtered)
      ══════════════════════════════════════════════════════════════ */}

      {/* ── 1A: Global KPIs (always full dataset) ── */}
      <div>
        <SectionLabel label="Toàn hệ thống" color="#0369a1" bg="#e0f2fe" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <KPICard
            title="Tổng nhân viên"
            value={globalTotalEmployees}
            icon={<Users size={20} />}
            accent="#0ea5e9"
            loading={perfLoading}
          />
          <KPICard
            title="Tổng lịch hẹn toàn hệ thống"
            value={globalTotalAppointments}
            icon={<Calendar size={20} />}
            accent="#6366f1"
            loading={perfLoading}
          />
          <KPICard
            title="Nhân viên xuất sắc"
            value={
              perfLoading
                ? "..."
                : topPerformer
                  ? displayName(topPerformer)
                  : "—"
            }
            subtitle={
              topPerformer
                ? `${topPerformer.totalAppointments.toLocaleString("vi-VN")} lịch hẹn`
                : undefined
            }
            icon={<Award size={20} />}
            accent="#f59e0b"
            loading={perfLoading}
            isText
          />
        </div>
      </div>
      {/* ══════════════════════════════════════════════════════════════
          EMPLOYEE FILTER + STATUS BAR
      ══════════════════════════════════════════════════════════════ */}
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

          {/* ── Compare dropdown (NEW) ── */}
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

          {/* Reset filter button */}
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
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#0369a1" }}
                >
                  {selectedEmployee.totalAppointments.toLocaleString("vi-VN")}
                </p>
                <p className="text-xs" style={{ color: "#7dd3fc" }}>
                  Lịch hẹn
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#0369a1" }}
                >
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
            </div>
          </div>
        )}
      </div>
      {/* ── 1B: Filtered KPIs (depend on selection) ── */}
      <div>
        <SectionLabel
          label={
            selectedEmployeeId
              ? `Của nhân viên đã chọn: ${displayName(selectedEmployee)}`
              : "Tổng quan nhân viên"
          }
          color={selectedEmployeeId ? "#0369a1" : "#475569"}
          bg={selectedEmployeeId ? "#dbeafe" : "#f1f5f9"}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <KPICard
            title={
              selectedEmployeeId
                ? "Lịch hẹn của nhân viên"
                : "Tổng lịch hẹn đã xử lý"
            }
            value={filteredTotalAppointments}
            icon={<Calendar size={20} />}
            accent="#6366f1"
            loading={perfLoading}
          />
          <KPICard
            title={
              selectedEmployeeId
                ? "Lịch hẹn trung bình"
                : "Lịch hẹn TB / nhân viên"
            }
            value={filteredAvgAppointments}
            icon={<TrendingUp size={20} />}
            accent="#10b981"
            loading={perfLoading}
            suffix=" lịch"
          />
          <KPICard
            title={
              selectedEmployeeId ? "BĐS đang phụ trách" : "Tổng bất động sản"
            }
            value={filteredTotalProperties}
            icon={<Home size={20} />}
            accent="#a855f7"
            loading={propLoading}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1C — COMPARISON + INSIGHTS (only when selected)
      ══════════════════════════════════════════════════════════════ */}
      {selectedEmployee && !perfLoading && (
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
                <p className="text-xs text-gray-400">
                  So sánh với mức trung bình
                </p>
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

              {/* Delta badge */}
              <div className="pt-1">
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={
                    vsAvgDiff >= 0
                      ? { background: "#dcfce7", color: "#15803d" }
                      : { background: "#fee2e2", color: "#b91c1c" }
                  }
                >
                  {vsAvgDiff >= 0 ? "▲" : "▼"} {Math.abs(vsAvgPct)}% so với TB
                  hệ thống
                </span>

                {!isTopPerformer && topPerformer && (
                  <p className="text-xs text-gray-400 mt-2">
                    Top hệ thống:{" "}
                    <span className="font-semibold text-gray-600">
                      {displayName(topPerformer)}
                    </span>{" "}
                    ({topPerformer.totalAppointments.toLocaleString("vi-VN")}{" "}
                    lịch)
                  </p>
                )}
              </div>
            </div>
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
                <p className="text-xs text-gray-400">
                  Dựa trên dữ liệu thực tế
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{
                    background: insight.positive ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${insight.positive ? "#bbf7d0" : "#fecaca"}`,
                  }}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {insight.positive ? (
                      <span style={{ color: "#16a34a", fontSize: 13 }}>✓</span>
                    ) : (
                      <AlertCircle
                        size={13}
                        style={{ color: "#dc2626", marginTop: 1 }}
                      />
                    )}
                  </span>
                  <p
                    className="text-xs font-medium"
                    style={{ color: insight.positive ? "#15803d" : "#b91c1c" }}
                  >
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1D — 2-EMPLOYEE COMPARISON BLOCK (NEW)
          Only rendered when BOTH selectedEmployeeId & compareEmployeeId
          are set and the employee records exist.
      ══════════════════════════════════════════════════════════════ */}
      {showComparison && selectedEmployee && compareEmployee && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#6366f114", color: "#6366f1" }}
            >
              <GitCompare size={17} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                So sánh nhân viên
              </h3>
              <p className="text-xs text-gray-400">
                Phân tích đối chiếu chỉ số hiệu suất theo thời gian thực
              </p>
            </div>
          </div>

          {/* ── Employee A vs B labels ── */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-6 items-center">
            {/* Employee A */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "linear-gradient(135deg, #eff6ff, #f0f9ff)",
                border: "1px solid #bfdbfe",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  A
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "#0369a1" }}
                  >
                    {displayName(selectedEmployee)}
                  </p>
                  <p className="text-xs font-mono" style={{ color: "#7dd3fc" }}>
                    {selectedEmployee.employeeCode}
                  </p>
                </div>
              </div>
            </div>

            {/* VS badge */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: "#f1f5f9", color: "#94a3b8" }}
            >
              VS
            </div>

            {/* Employee B */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                border: "1px solid #a7f3d0",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: "#10b981", color: "#fff" }}
                >
                  B
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "#047857" }}
                  >
                    {displayName(compareEmployee)}
                  </p>
                  <p className="text-xs font-mono" style={{ color: "#6ee7b7" }}>
                    {compareEmployee.employeeCode}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Metric progress bars grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {comparisonMetrics.map((metric) => (
              <CompareMetricRow key={metric.label} metric={metric} />
            ))}
          </div>

          {/* ── Auto-generated insights ── */}
          {compareInsightsToShow.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "#fafafa",
                border: "1px solid #f1f5f9",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} style={{ color: "#f59e0b" }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#78716c" }}
                >
                  Nhận xét tự động
                </span>
              </div>
              <div className="space-y-2">
                {compareInsightsToShow.map((text, i) => {
                  const isWarning = text.startsWith("⚠");
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg"
                      style={{
                        background: isWarning ? "#fffbeb" : "#f0fdf4",
                        border: `1px solid ${isWarning ? "#fde68a" : "#bbf7d0"}`,
                      }}
                    >
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: isWarning ? "#92400e" : "#15803d",
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — PROPERTY MANAGEMENT (Nguồn hàng)
      ══════════════════════════════════════════════════════════════ */}
      <ChartCard
        title="Phân bổ nguồn hàng theo nhân viên"
        subtitle={
          selectedEmployeeId
            ? "Top 10 toàn hệ thống — nhân viên đã chọn được đánh dấu"
            : "Top 10 nhân viên phụ trách nhiều bất động sản nhất (Nhà & Đất)"
        }
        headerBadge={
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: "#0ea5e914", color: "#0ea5e9" }}
          >
            <Home size={11} />
            Nguồn hàng
          </span>
        }
      >
        {propLoading ? (
          <ChartSkeleton height={320} />
        ) : top10Props.length === 0 ? (
          selectedEmployeeId ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl"
              style={{
                height: 200,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <AlertCircle size={20} style={{ color: "#94a3b8" }} />
              <p style={{ color: "#94a3b8", fontSize: 14 }}>
                Nhân viên này chưa có dữ liệu bất động sản
              </p>
              <p style={{ color: "#cbd5e1", fontSize: 12 }}>
                Gợi ý: kiểm tra phân công hoặc hoạt động gần đây
              </p>
            </div>
          ) : (
            <EmptyState message="Chưa có dữ liệu phân bổ bất động sản" />
          )
        ) : (
          // Custom recharts bar chart with per-bar cell coloring for highlight
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={top10Props}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  color: "#64748b",
                  fontSize: 12,
                  paddingTop: 12,
                }}
              />
              <Bar
                dataKey="Nhà"
                name="Nhà"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
              >
                {top10Props.map((entry, index) => {
                  const isAnyFilter =
                    selectedEmployeeId !== null || compareEmployeeId !== null;
                  const isSelected =
                    selectedEmployeeId !== null &&
                    entry.employeeId === selectedEmployeeId;
                  const isCompared =
                    compareEmployeeId !== null &&
                    entry.employeeId === compareEmployeeId;
                  return (
                    <Cell
                      key={`nhà-${index}`}
                      fill={
                        isSelected
                          ? "#6366f1"
                          : isCompared
                            ? "#f97316"
                            : "#a5b4fc"
                      }
                      opacity={
                        isAnyFilter ? (isSelected || isCompared ? 1 : 0.35) : 1
                      }
                      stroke={
                        isSelected ? "#4f46e5" : isCompared ? "#ea580c" : "none"
                      }
                      strokeWidth={isSelected || isCompared ? 2 : 0}
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="Đất"
                name="Đất"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
              >
                {top10Props.map((entry, index) => {
                  const isAnyFilter =
                    selectedEmployeeId !== null || compareEmployeeId !== null;
                  const isSelected =
                    selectedEmployeeId !== null &&
                    entry.employeeId === selectedEmployeeId;
                  const isCompared =
                    compareEmployeeId !== null &&
                    entry.employeeId === compareEmployeeId;
                  return (
                    <Cell
                      key={`đất-${index}`}
                      fill={
                        isSelected
                          ? "#10b981"
                          : isCompared
                            ? "#fb923c"
                            : "#6ee7b7"
                      }
                      opacity={
                        isAnyFilter ? (isSelected || isCompared ? 1 : 0.35) : 1
                      }
                      stroke={
                        isSelected ? "#059669" : isCompared ? "#f97316" : "none"
                      }
                      strokeWidth={isSelected || isCompared ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — APPOINTMENT PERFORMANCE (Hiệu suất lịch hẹn)
      ══════════════════════════════════════════════════════════════ */}
      <ChartCard
        title="Hiệu suất xử lý lịch hẹn"
        subtitle={
          selectedEmployeeId
            ? "Top 10 toàn hệ thống — nhân viên đã chọn được đánh dấu"
            : "Top 10 nhân viên theo số lượng lịch hẹn được giao & hoàn thành"
        }
        headerBadge={
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: "#6366f114", color: "#6366f1" }}
          >
            <Map size={11} />
            Lịch hẹn
          </span>
        }
      >
        {perfLoading ? (
          <ChartSkeleton height={320} />
        ) : top10Perf.length === 0 ? (
          selectedEmployeeId ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl"
              style={{
                height: 200,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <AlertCircle size={20} style={{ color: "#94a3b8" }} />
              <p style={{ color: "#94a3b8", fontSize: 14 }}>
                Nhân viên này chưa có dữ liệu lịch hẹn
              </p>
              <p style={{ color: "#cbd5e1", fontSize: 12 }}>
                Gợi ý: kiểm tra phân công hoặc hoạt động gần đây
              </p>
            </div>
          ) : (
            <EmptyState message="Chưa có dữ liệu hiệu suất nhân viên" />
          )
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={top10Perf}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  color: "#64748b",
                  fontSize: 12,
                  paddingTop: 12,
                }}
              />
              <Bar
                dataKey="Tổng lịch hẹn"
                name="Tổng lịch hẹn"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
              >
                {top10Perf.map((entry, index) => {
                  const isAnyFilter =
                    selectedEmployeeId !== null || compareEmployeeId !== null;
                  const isSelected =
                    selectedEmployeeId !== null &&
                    entry.employeeId === selectedEmployeeId;
                  const isCompared =
                    compareEmployeeId !== null &&
                    entry.employeeId === compareEmployeeId;
                  return (
                    <Cell
                      key={`total-${index}`}
                      fill={
                        isSelected
                          ? "#0ea5e9"
                          : isCompared
                            ? "#f97316"
                            : "#7dd3fc"
                      }
                      opacity={
                        isAnyFilter ? (isSelected || isCompared ? 1 : 0.4) : 1
                      }
                      stroke={
                        isSelected ? "#0284c7" : isCompared ? "#ea580c" : "none"
                      }
                      strokeWidth={isSelected || isCompared ? 2 : 0}
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="Hoàn thành"
                name="Hoàn thành"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
              >
                {top10Perf.map((entry, index) => {
                  const isAnyFilter =
                    selectedEmployeeId !== null || compareEmployeeId !== null;
                  const isSelected =
                    selectedEmployeeId !== null &&
                    entry.employeeId === selectedEmployeeId;
                  const isCompared =
                    compareEmployeeId !== null &&
                    entry.employeeId === compareEmployeeId;
                  return (
                    <Cell
                      key={`done-${index}`}
                      fill={
                        isSelected
                          ? "#10b981"
                          : isCompared
                            ? "#fb923c"
                            : "#6ee7b7"
                      }
                      opacity={
                        isAnyFilter ? (isSelected || isCompared ? 1 : 0.4) : 1
                      }
                      stroke={
                        isSelected ? "#059669" : isCompared ? "#f97316" : "none"
                      }
                      strokeWidth={isSelected || isCompared ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — RANKING TABLE
      ══════════════════════════════════════════════════════════════ */}
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
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "#f59e0b14", color: "#f59e0b" }}
          >
            {performance.length} nhân viên
          </span>
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
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {[
                    "#",
                    "Nhân viên",
                    "Mã NV",
                    "Tổng lịch hẹn",
                    "Hoàn thành",
                    "Tỷ lệ chốt",
                    "BĐS phụ trách",
                    ...(selectedEmployeeId !== null ||
                    compareEmployeeId !== null
                      ? [""]
                      : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="pb-3 pr-4 text-left font-semibold"
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
                  const ratePct = ((emp.completionRate ?? 0) * 100).toFixed(0);
                  const rateColor =
                    emp.completionRate >= 0.7
                      ? "#10b981"
                      : emp.completionRate >= 0.4
                        ? "#f59e0b"
                        : "#ef4444";
                  const isSelected = emp.employeeId === selectedEmployeeId;
                  const isCompared = emp.employeeId === compareEmployeeId;

                  // Row background & border: selected=blue, compared=green, both can't coexist
                  const rowStyle: React.CSSProperties = {
                    borderBottom: "1px solid #f8fafc",
                    background: isSelected
                      ? "linear-gradient(90deg, #eff6ff, #f0f9ff)"
                      : isCompared
                        ? "linear-gradient(90deg, #f0fdf4, #ecfdf5)"
                        : undefined,
                    borderLeft: isSelected
                      ? "3px solid #0ea5e9"
                      : isCompared
                        ? "3px solid #10b981"
                        : "3px solid transparent",
                  };

                  return (
                    <tr
                      key={emp.employeeId}
                      style={rowStyle}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-3 pr-4">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={
                            idx < 3
                              ? { background: "#f59e0b18", color: "#f59e0b" }
                              : { background: "#f1f5f9", color: "#94a3b8" }
                          }
                        >
                          {idx + 1}
                        </span>
                      </td>
                      {/* Name */}
                      <td className="py-3 pr-4 font-medium text-gray-700">
                        <span>{emp.fullName}</span>
                      </td>
                      {/* Code */}
                      <td className="py-3 pr-4">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-mono"
                          style={{ background: "#f1f5f9", color: "#64748b" }}
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
                            className="h-1.5 w-16 rounded-full overflow-hidden"
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
                      <td className="py-3">
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
  );
};

export default EmployeeAnalyticsPage;
