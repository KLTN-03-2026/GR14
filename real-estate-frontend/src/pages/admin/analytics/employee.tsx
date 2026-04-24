// src/pages/admin/analytics/employee.tsx
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import { KPICard } from "@/components/analytics/charts";
import { Calendar, TrendingUp, Home } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
import type { TimeType } from "@/types/analytics";

// ─── Hook ─────────────────────────────────────────────────────────────────────
import { useEmployeeAnalyticsData } from "@/hooks/useEmployeeAnalyticsData";

// ─── Split components ──────────────────────────────────────────────────────────
import { EmployeeKPISection } from "@/components/analytics/EmployeeKPISection";
import { EmployeeTable } from "@/components/analytics/EmployeeTable";
import { EmployeeChartSection } from "@/components/analytics/EmployeeChartSection";
import { EmployeeFilterBar } from "@/components/analytics/EmployeeFilterBar";
import { EmployeeInsightPanel } from "@/components/analytics/EmployeeInsightPanel";
import { EmployeeComparisonPanel } from "@/components/analytics/EmployeeComparisonPanel";

// ─── Local UI helpers (small, stateless, no logic) ────────────────────────────

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

// ─── Employee Analytics Page ───────────────────────────────────────────────────

const EmployeeAnalyticsPage: React.FC = () => {
  // ── Sync with global time filter from DashboardPage context ──
  const { timeType } = useAnalyticsContext();

  // ── All logic from the hook ──────────────────────────────────
  const state = useEmployeeAnalyticsData(timeType as TimeType);

  const {
    performance,
    perfLoading,
    propLoading,

    selectedEmployeeId,
    setSelectedEmployeeId,
    compareEmployeeId,
    setCompareEmployeeId,

    selectedEmployee,
    compareEmployee,
    selectedEmployeeProps,

    filteredTotalAppointments,
    filteredAvgAppointments,
    filteredTotalProperties,

    sortedPerf,
    sortBy,
    setSortBy,

    top10Perf,
    top10Props,

    insights,
    comparisonMetrics,
    compareInsightsToShow,

    globalTotalEmployees,
    globalTotalAppointments,
    globalAvgAppointments,
    topPerformer,
    isTopPerformer,

    showComparison,

    propertyMap,
    tableRef,
    exporting,

    displayName,
    exportPDF,
    handleExportExcel,
  } = state;

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — KPI CARDS (split into global vs filtered)
      ══════════════════════════════════════════════════════════════ */}

      {/* ── 1A: Global KPIs (always full dataset) ── */}
      <div>
        <EmployeeKPISection
          perfLoading={perfLoading}
          globalTotalEmployees={globalTotalEmployees}
          globalTotalAppointments={globalTotalAppointments}
          topPerformer={topPerformer}
          displayName={displayName}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          EMPLOYEE FILTER + STATUS BAR
      ══════════════════════════════════════════════════════════════ */}
      <EmployeeFilterBar
        performance={performance}
        perfLoading={perfLoading}
        selectedEmployeeId={selectedEmployeeId}
        compareEmployeeId={compareEmployeeId}
        setSelectedEmployeeId={setSelectedEmployeeId}
        setCompareEmployeeId={setCompareEmployeeId}
        selectedEmployee={selectedEmployee}
        selectedEmployeeProps={selectedEmployeeProps}
        isTopPerformer={isTopPerformer}
        displayName={displayName}
        insights={insights}
        globalAvgAppointments={globalAvgAppointments}
        topPerformer={topPerformer}
      />

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
          SECTION 1C — PERFORMANCE vs SYSTEM + INSIGHTS (when selected)
      ══════════════════════════════════════════════════════════════ */}
      {selectedEmployee && !perfLoading && (
        <EmployeeInsightPanel
          selectedEmployee={selectedEmployee}
          globalAvgAppointments={globalAvgAppointments}
          topPerformer={topPerformer}
          insights={insights}
          displayName={displayName}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — 2-EMPLOYEE SIDE-BY-SIDE COMPARISON
      ══════════════════════════════════════════════════════════════ */}
      {showComparison && selectedEmployee && compareEmployee && (
        <EmployeeComparisonPanel
          selectedEmployee={selectedEmployee}
          compareEmployee={compareEmployee}
          comparisonMetrics={comparisonMetrics}
          compareInsightsToShow={compareInsightsToShow}
          displayName={displayName}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — CHARTS
      ══════════════════════════════════════════════════════════════ */}
      <EmployeeChartSection
        perfLoading={perfLoading}
        propLoading={propLoading}
        top10Perf={top10Perf}
        top10Props={top10Props}
        selectedEmployeeId={selectedEmployeeId}
        compareEmployeeId={compareEmployeeId}
        CustomTooltip={CustomTooltip}
        timeType={timeType}
      />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — RANKING TABLE
      ══════════════════════════════════════════════════════════════ */}
      {/* FEATURE: Wrap the ranking card in tableRef for PDF export */}
      <div ref={tableRef}>
        <EmployeeTable
          sortedPerf={sortedPerf}
          perfLoading={perfLoading}
          propertyMap={propertyMap}
          selectedEmployeeId={selectedEmployeeId}
          compareEmployeeId={compareEmployeeId}
          sortBy={sortBy}
          setSortBy={setSortBy}
          performance={performance}
          exportPDF={exportPDF}
          exporting={exporting}
          exportExcel={handleExportExcel}
        />
      </div>
    </div>
  );
};

export default EmployeeAnalyticsPage;
