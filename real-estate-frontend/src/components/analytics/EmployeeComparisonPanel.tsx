// src/components/analytics/EmployeeComparisonPanel.tsx
import { GitCompare } from "lucide-react";
import type { EmployeePerformance } from "@/types/analytics";
import type { ComparisonMetric } from "@/hooks/useEmployeeAnalyticsData";

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

// ─── Comparison Panel ─────────────────────────────────────────────────────────

interface Props {
  selectedEmployee: EmployeePerformance;
  compareEmployee: EmployeePerformance;
  comparisonMetrics: ComparisonMetric[];
  compareInsightsToShow: string[];
  displayName: (emp: EmployeePerformance | null | undefined) => string;
}

export const EmployeeComparisonPanel = ({
  selectedEmployee,
  compareEmployee,
  comparisonMetrics,
  compareInsightsToShow,
  displayName,
}: Props) => {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "#6366f114", color: "#6366f1" }}
        >
          <GitCompare size={15} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-800">
            So sánh chi tiết
          </h3>
          <p className="text-xs text-gray-400">
            <span className="font-medium" style={{ color: "#0ea5e9" }}>
              {displayName(selectedEmployee)}
            </span>{" "}
            vs{" "}
            <span className="font-medium" style={{ color: "#10b981" }}>
              {displayName(compareEmployee)}
            </span>
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {comparisonMetrics.map((m) => (
          <CompareMetricRow key={m.label} metric={m} />
        ))}
      </div>

      {/* Auto insights */}
      {compareInsightsToShow.length > 0 && (
        <div className="space-y-2">
          {compareInsightsToShow.map((ins, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "#fffbeb", color: "#92400e" }}
            >
              <span>💡</span>
              <span>{ins}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
