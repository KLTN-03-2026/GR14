// src/hooks/useEmployeeAnalyticsData.ts
import { useState, useEffect, useMemo, useRef } from "react";
import { analyticsApi } from "@/api/analytics";
import { useEmployeeAnalytics } from "@/hooks/useEmployeeAnalytics";
import type { TimeType, EmployeePerformance } from "@/types/analytics";
import { registerVietnameseFont, VIET_FONT_NAME } from "@/utils/pdfFontLoader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportEmployeeExcelV2 } from "@/utils/exportEmployeeExcelV2";

// ===== TYPES =====
export interface EmployeeProperty {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  houses: number;
  lands: number;
  total: number;
}

export interface ComparisonMetric {
  label: string;
  valueA: number;
  valueB: number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

export type SortBy = "appointments" | "score";

// =====================================================

export const useEmployeeAnalyticsData = (timeType: TimeType) => {
  // ── STATE ───────────────────────────────────────────
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [compareEmployeeId, setCompareEmployeeId] = useState<number | null>(
    null,
  );

  const [properties, setProperties] = useState<EmployeeProperty[]>([]);
  const [propLoading, setPropLoading] = useState(true);

  const [sortBy, setSortBy] = useState<SortBy>("appointments");

  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // ── FETCH ───────────────────────────────────────────
  const { data, loading } = useEmployeeAnalytics(timeType);
  const performance = data ?? [];
  const perfLoading = loading ?? false;

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

  // ── MAP ─────────────────────────────────────────────
  const propertyMap = useMemo(() => {
    const map: Map<number, EmployeeProperty> = new globalThis.Map();
    properties.forEach((p) => map.set(p.employeeId, p));
    return map;
  }, [properties]);

  // ── FILTER ──────────────────────────────────────────
  const filteredPerf = selectedEmployeeId
    ? performance.filter((e) => e.employeeId === selectedEmployeeId)
    : performance;

  const filteredProps = selectedEmployeeId
    ? properties.filter((e) => e.employeeId === selectedEmployeeId)
    : properties;

  // ── SELECTED ────────────────────────────────────────
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

  // ── CHART ──────────────────────────────────────────
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

  // ── HELPERS ────────────────────────────────────────
  const displayName = (emp: EmployeePerformance | null | undefined) =>
    emp ? (emp.fullName !== "N/A" ? emp.fullName : emp.employeeCode) : "—";

  const formatStatus = (status: string) => {
    if (status === "active") return "Hoạt động";
    if (status === "idle") return "Vắng";
    return "Không HĐ";
  };

  // ── INSIGHT ────────────────────────────────────────
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
          // Score comparison
          {
            label: "Điểm hiệu suất",
            valueA: selectedEmployee.score ?? 0,
            valueB: compareEmployee.score ?? 0,
            format: (v: number) => v.toFixed(0),
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

  // ── TABLE ──────────────────────────────────────────
  // Show all rows when both filters are active so both employees can be
  // highlighted; otherwise keep original filtered behaviour
  const tablePerfSource =
    selectedEmployeeId !== null && compareEmployeeId !== null
      ? performance
      : filteredPerf;

  // sortBy state drives the sort comparator.
  // 'appointments' preserves the original behaviour exactly.
  // 'score' sorts by the normalised score field (descending).
  const sortedPerf = useMemo(() => {
    return [...tablePerfSource].sort((a, b) =>
      sortBy === "score"
        ? (b.score ?? 0) - (a.score ?? 0)
        : b.totalAppointments - a.totalAppointments,
    );
  }, [tablePerfSource, sortBy]);

  // ── EXPORT PDF ─────────────────────────────────────
  // Captures the ranking table div with html2canvas then writes to jsPDF.
  const exportPDF = async (): Promise<void> => {
    if (!sortedPerf || sortedPerf.length === 0) {
      alert("Không có dữ liệu để xuất PDF");
      return;
    }

    setExporting(true);

    try {
      // 1. Create document
      const doc = new jsPDF("l", "mm", "a4");
      const PAGE_W = doc.internal.pageSize.getWidth(); // 297 mm (landscape A4)
      const PAGE_H = doc.internal.pageSize.getHeight(); // 210 mm
      const MARGIN = 12;

      // 2. Embed Unicode font
      await registerVietnameseFont(doc);

      // 3. Header bar
      doc.setFillColor(30, 41, 59); // dark navy
      doc.rect(0, 0, PAGE_W, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont(VIET_FONT_NAME, "bold");
      doc.setFontSize(16);
      doc.text("BÁO CÁO HIỆU SUẤT NHÂN VIÊN", MARGIN, 14);

      const todayStr = new Date().toLocaleDateString("vi-VN");
      doc.setFontSize(9);
      doc.setFont(VIET_FONT_NAME, "normal");
      doc.text(
        `Ngày xuất: ${todayStr} | Bộ lọc: ${timeType}`,
        PAGE_W - MARGIN,
        14,
        { align: "right" },
      );

      // 4. KPI summary boxes
      const totalAppointments = sortedPerf.reduce(
        (sum, e) => sum + (e.totalAppointments ?? 0),
        0,
      );
      const avgRate =
        sortedPerf.length > 0
          ? (
              (sortedPerf.reduce((s, e) => s + (e.completionRate ?? 0), 0) /
                sortedPerf.length) *
              100
            ).toFixed(1)
          : "0";

      const BOX_Y = 30;
      const BOX_W = 80;
      const BOX_H = 22;
      const BOX_GAP = 10;

      const drawKPIBox = (x: number, label: string, value: string) => {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x, BOX_Y, BOX_W, BOX_H, 3, 3, "F");

        // label
        doc.setFontSize(9);
        doc.setFont(VIET_FONT_NAME, "normal");
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(label, x + 6, BOX_Y + 8);

        // value
        doc.setFontSize(16);
        doc.setFont(VIET_FONT_NAME, "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(value, x + 6, BOX_Y + 17);
      };

      drawKPIBox(MARGIN, "Nhân viên", String(sortedPerf.length));
      drawKPIBox(
        MARGIN + BOX_W + BOX_GAP,
        "Lịch hẹn",
        String(totalAppointments),
      );
      drawKPIBox(
        MARGIN + (BOX_W + BOX_GAP) * 2,
        "Tỷ lệ hoàn thành",
        `${avgRate}%`,
      );

      // 5. Data table
      // IMPORTANT: pass `font` in every styles block.
      // Without it autoTable falls back to the jsPDF default font for that run,
      // which is "helvetica" — breaking Vietnamese text inside cells.
      autoTable(doc, {
        startY: BOX_Y + BOX_H + 10,
        margin: { left: MARGIN, right: MARGIN },
        tableWidth: "auto",

        head: [
          [
            "#",
            "Nhân viên",
            "Tổng lịch",
            "Hoàn thành",
            "%",
            "BĐS",
            "Score",
            "Trạng thái",
          ],
        ],

        body: sortedPerf.map((e, i) => [
          i + 1,
          e.fullName ?? "",
          (e.totalAppointments ?? 0).toLocaleString("vi-VN"),
          (e.completed ?? 0).toLocaleString("vi-VN"),
          `${((e.completionRate ?? 0) * 100).toFixed(1)}%`,
          e.totalProperties ?? 0,
          Math.round(e.score ?? 0),
          formatStatus(e.activityStatus ?? "inactive"),
        ]),

        // Typography: every style block must declare the Unicode font
        styles: {
          font: VIET_FONT_NAME,
          fontStyle: "normal",
          fontSize: 9,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          valign: "middle",
          overflow: "linebreak",
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.2,
        },

        headStyles: {
          font: VIET_FONT_NAME,
          fontStyle: "bold",
          fillColor: [14, 165, 233], // sky-500
          textColor: 255,
          fontSize: 9,
        },

        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },

        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 60 },
          2: { cellWidth: 25, halign: "right" },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 20, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 32 },
        },

        // Highlight the top-ranked row in gold
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fillColor = [254, 240, 138]; // yellow-200
            data.cell.styles.textColor = [92, 64, 0]; // amber-900
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.font = VIET_FONT_NAME; // keep Unicode font even here
          }
        },
      });

      // 6. Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages() as number;

      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont(VIET_FONT_NAME, "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400

        // Centre line
        doc.text("Black's City Real Estate System", PAGE_W / 2, PAGE_H - 5, {
          align: "center",
        });

        // Right: page number
        doc.text(`${p}/${pageCount}`, PAGE_W - MARGIN, PAGE_H - 5, {
          align: "right",
        });
      }

      // 7. Save
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`employee_report_${dateStr}.pdf`);
    } catch (err) {
      console.error("[exportPDF] Error:", err);
      alert(
        "Xuất PDF thất bại. Vui lòng kiểm tra kết nối mạng (cần tải font) và thử lại.",
      );
    } finally {
      setExporting(false);
    }
  };

  // ── EXPORT EXCEL ───────────────────────────────────
  const handleExportExcel = () => {
    exportEmployeeExcelV2({
      data: sortedPerf,
      summary: {
        totalEmployees: performance.length,
        totalAppointments: performance.reduce(
          (s, e) => s + e.totalAppointments,
          0,
        ),
        completionRate:
          performance.length > 0
            ? Number(
                (
                  (performance.reduce((s, e) => s + e.completionRate, 0) /
                    performance.length) *
                  100
                ).toFixed(1),
              )
            : 0,
      },
      timeType,
    });
  };

  // ── RETURN ─────────────────────────────────────────
  return {
    // Raw data
    performance,
    perfLoading,
    properties,
    propLoading,

    // Selection state
    selectedEmployeeId,
    setSelectedEmployeeId,
    compareEmployeeId,
    setCompareEmployeeId,

    // Resolved employee objects
    selectedEmployee,
    compareEmployee,
    selectedEmployeeProps,
    compareEmployeeProps,

    // Filtered datasets
    filteredPerf,
    filteredProps,

    // Filtered KPIs
    filteredTotalAppointments,
    filteredAvgAppointments,
    filteredTotalProperties,

    // Sorting
    sortedPerf,
    sortBy,
    setSortBy,

    // Chart data
    top10Perf,
    top10Props,

    // Insights
    insights,
    comparisonMetrics,
    comparisonInsights,
    compareInsightsToShow,

    // Global KPIs
    globalTotalEmployees,
    globalTotalAppointments,
    globalAvgAppointments,
    topPerformer,
    isTopPerformer,

    // Comparison flag
    showComparison,

    // vs-average derivations (used in insight panel)
    vsAvgDiff,
    vsAvgPct,

    // Misc
    propertyMap,
    tableRef,
    exporting,
    setExporting,

    // Helper functions
    displayName,
    exportPDF,
    handleExportExcel,
  };
};
