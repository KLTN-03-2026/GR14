import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  fullName: string;
  totalAppointments: number;
  completed: number;
  completionRate: number;
  totalProperties?: number;
  score?: number;
  activityStatus?: string;
}

interface ExportParams {
  data: Employee[];
  summary: {
    totalEmployees: number;
    totalAppointments: number;
    completionRate: number;
  };
  timeType: "day" | "month" | "year";
}

// ─── Color Palette ────────────────────────────────────────────────────────────

const COLOR = {
  // Brand - softer, professional tones
  primaryDark: "1F2937",
  primary: "3B82F6",
  primaryLight: "EFF6FF",
  primaryMid: "F8FAFC",

  // Neutrals
  white: "FFFFFF",
  gray50: "F9FAFB",
  gray100: "F3F4F6",
  gray200: "E5E7EB",
  gray300: "D1D5DB",
  gray400: "9CA3AF",
  gray500: "6B7280",
  gray700: "374151",
  gray900: "111827",

  // Semantic - softer, professional
  greenBg: "ECFDF5",
  greenText: "047857",
  yellowBg: "FEFCE8",
  yellowText: "B45309",
  redBg: "FEF2F2",
  redText: "DC2626",

  // KPI cards
  kpi1Bg: "EFF6FF",
  kpi1Accent: "3B82F6",
  kpi2Bg: "F0FDF4",
  kpi2Accent: "10B981",
  kpi3Bg: "FEF3C7",
  kpi3Accent: "D97706",

  // Top performer
  topBg: "FEFCE8",
  topAccent: "B45309",

  // Table
  tableHeaderBg: "1F2937",
  tableHeaderText: "FFFFFF",
  tableEvenRowBg: "FFFFFF",
  tableOddRowBg: "F9FAFB",
  tableBorderColor: "E5E7EB",
} as const;

// ─── Style Helpers ────────────────────────────────────────────────────────────

type ArgbColor = string;

const DIAG = {} as ExcelJS.Border; // satisfies required `diagonal` field

function solidFill(argb: ArgbColor): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb } };
}

function thinBorder(
  color: ArgbColor = COLOR.tableBorderColor,
): ExcelJS.Borders {
  const side: ExcelJS.Border = { style: "thin", color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side, diagonal: DIAG };
}

function lightBorder(color: ArgbColor = COLOR.gray200): ExcelJS.Borders {
  const side: ExcelJS.Border = { style: "thin", color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side, diagonal: DIAG };
}

function bottomAccentBorder(accentColor: ArgbColor): ExcelJS.Borders {
  const thin: ExcelJS.Border = {
    style: "thin",
    color: { argb: COLOR.gray200 },
  };
  const thick: ExcelJS.Border = {
    style: "medium",
    color: { argb: accentColor },
  };
  return { top: thin, left: thin, bottom: thick, right: thin, diagonal: DIAG };
}

function topAccentBorder(accentColor: ArgbColor): ExcelJS.Borders {
  const thin: ExcelJS.Border = {
    style: "thin",
    color: { argb: COLOR.gray200 },
  };
  const thick: ExcelJS.Border = { style: "thin", color: { argb: accentColor } };
  return { top: thick, left: thin, bottom: thin, right: thin, diagonal: DIAG };
}

function sectionLabelBorder(): ExcelJS.Borders {
  const none = {} as ExcelJS.Border;
  const btm: ExcelJS.Border = { style: "thin", color: { argb: COLOR.gray200 } };
  return { top: none, left: none, right: none, bottom: btm, diagonal: DIAG };
}

function applyCell(
  cell: ExcelJS.Cell,
  opts: {
    value?: ExcelJS.CellValue;
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    border?: ExcelJS.Borders;
    alignment?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  },
) {
  if (opts.value !== undefined) cell.value = opts.value;
  if (opts.font) cell.font = opts.font as ExcelJS.Font;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.border) cell.border = opts.border;
  if (opts.alignment) cell.alignment = opts.alignment as ExcelJS.Alignment;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const TIME_LABEL: Record<string, string> = {
  day: "Theo ngày",
  month: "Theo tháng",
  year: "Theo năm",
};

const mapStatus = (status?: string): string => {
  switch (status) {
    case "active":
      return "🟢 Hoạt động";
    case "idle":
      return "🟡 Vắng mặt";
    default:
      return "🔴 Không HĐ";
  }
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const exportEmployeeExcelV2 = async ({
  data,
  summary,
  timeType,
}: ExportParams): Promise<void> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HR Dashboard";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Sheet setup ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Báo cáo", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    },
    headerFooter: {
      oddFooter:
        '&L&"Arial,Regular"&8Báo cáo hiệu suất nhân viên&C&P / &N&R&8Xuất: &D',
    },
  });

  // ── Column widths ─────────────────────────────────────────────────────────────
  ws.columns = [
    { width: 5 }, // A  #
    { width: 26 }, // B  Nhân viên
    { width: 14 }, // C  Tổng lịch
    { width: 14 }, // D  Hoàn thành
    { width: 12 }, // E  %
    { width: 10 }, // F  BĐS
    { width: 10 }, // G  Score
    { width: 18 }, // H  Trạng thái
  ];

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 1 — decorative top accent bar
  // ════════════════════════════════════════════════════════════════════════════
  ws.mergeCells("A1:H1");
  applyCell(ws.getCell("A1"), {
    fill: solidFill(COLOR.primary),
  });
  ws.getRow(1).height = 8;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 2 – main title
  // ════════════════════════════════════════════════════════════════════════════
  ws.mergeCells("A2:H2");
  applyCell(ws.getCell("A2"), {
    value: "BÁO CÁO HIỆU SUẤT NHÂN VIÊN",
    font: {
      name: "Segoe UI",
      size: 24,
      bold: true,
      color: { argb: COLOR.white },
    },
    fill: solidFill(COLOR.primary),
    alignment: { horizontal: "center", vertical: "middle" },
  });
  ws.getRow(2).height = 48;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 3 – subtitle / metadata
  // ════════════════════════════════════════════════════════════════════════════
  ws.mergeCells("A3:D3");
  applyCell(ws.getCell("A3"), {
    value: `📅  Ngày xuất: ${new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    font: {
      name: "Segoe UI",
      size: 9,
      italic: true,
      color: { argb: COLOR.white },
    },
    fill: solidFill(COLOR.primary),
    alignment: { horizontal: "left", vertical: "middle", indent: 1 },
  });

  ws.mergeCells("E3:H3");
  applyCell(ws.getCell("E3"), {
    value: `🔍  Bộ lọc: ${TIME_LABEL[timeType] ?? timeType}`,
    font: {
      name: "Segoe UI",
      size: 9,
      italic: true,
      color: { argb: COLOR.white },
    },
    fill: solidFill(COLOR.primary),
    alignment: { horizontal: "right", vertical: "middle", indent: 1 },
  });
  ws.getRow(3).height = 20;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 4 – spacer
  // ════════════════════════════════════════════════════════════════════════════
  ws.getRow(4).height = 14;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 5 – KPI section label
  // ════════════════════════════════════════════════════════════════════════════
  ws.mergeCells("A5:H5");
  applyCell(ws.getCell("A5"), {
    value: "TỔNG QUAN KỲ BÁO CÁO",
    font: {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: COLOR.gray700 },
    },
    fill: solidFill(COLOR.primaryMid),
    alignment: { horizontal: "left", vertical: "middle", indent: 1 },
    border: sectionLabelBorder(),
  });
  ws.getRow(5).height = 20;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 6 – KPI card labels
  // ════════════════════════════════════════════════════════════════════════════
  const buildKpiCard = (
    labelCell: string,
    valueCell: string,
    mergeLabel: string,
    mergeValue: string,
    label: string,
    value: ExcelJS.CellValue,
    bgColor: string,
    accentColor: string,
  ) => {
    ws.mergeCells(mergeLabel);
    applyCell(ws.getCell(labelCell), {
      value: label,
      font: {
        name: "Segoe UI",
        size: 8,
        bold: true,
        color: { argb: accentColor },
      },
      fill: solidFill(bgColor),
      alignment: { horizontal: "center", vertical: "middle" },
      border: topAccentBorder(accentColor),
    });

    ws.mergeCells(mergeValue);
    applyCell(ws.getCell(valueCell), {
      value,
      font: {
        name: "Segoe UI",
        size: 28,
        bold: true,
        color: { argb: accentColor },
      },
      fill: solidFill(bgColor),
      alignment: { horizontal: "center", vertical: "middle" },
      border: bottomAccentBorder(accentColor),
    });
  };

  // KPI 1 – Employees (A6:B6 label, A7:B7 value)
  buildKpiCard(
    "A6",
    "A7",
    "A6:B6",
    "A7:B7",
    "👤  NHÂN VIÊN",
    summary.totalEmployees,
    COLOR.kpi1Bg,
    COLOR.kpi1Accent,
  );

  // KPI 2 – Appointments (D6:E6 label, D7:E7 value)
  buildKpiCard(
    "D6",
    "D7",
    "D6:E6",
    "D7:E7",
    "📋  LỊCH HẸN",
    summary.totalAppointments,
    COLOR.kpi2Bg,
    COLOR.kpi2Accent,
  );

  // KPI 3 – Completion rate (G6:H6 label, G7:H7 value)
  buildKpiCard(
    "G6",
    "G7",
    "G6:H6",
    "G7:H7",
    "✅  HOÀN THÀNH",
    `${summary.completionRate}%`,
    COLOR.kpi3Bg,
    COLOR.kpi3Accent,
  );

  ws.getRow(6).height = 18;
  ws.getRow(7).height = 50;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 8 – spacer
  // ════════════════════════════════════════════════════════════════════════════
  ws.getRow(8).height = 14;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 9 – table section label
  // ════════════════════════════════════════════════════════════════════════════
  ws.mergeCells("A9:H9");
  applyCell(ws.getCell("A9"), {
    value: "CHI TIẾT HIỆU SUẤT THEO NHÂN VIÊN",
    font: {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: COLOR.gray700 },
    },
    fill: solidFill(COLOR.primaryMid),
    alignment: { horizontal: "left", vertical: "middle", indent: 1 },
    border: sectionLabelBorder(),
  });
  ws.getRow(9).height = 20;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROW 10 – table header
  // ════════════════════════════════════════════════════════════════════════════
  const TABLE_HEADER_ROW = 10;

  const headers: [string, string][] = [
    ["A10", "#"],
    ["B10", "Nhân viên"],
    ["C10", "Tổng lịch"],
    ["D10", "Hoàn thành"],
    ["E10", "Tỷ lệ %"],
    ["F10", "BĐS"],
    ["G10", "Score"],
    ["H10", "Trạng thái"],
  ];

  headers.forEach(([ref, label]) => {
    applyCell(ws.getCell(ref), {
      value: label,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: COLOR.tableHeaderText },
      },
      fill: solidFill(COLOR.tableHeaderBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(COLOR.tableHeaderBg),
    });
  });

  ws.getRow(TABLE_HEADER_ROW).height = 32;

  // ════════════════════════════════════════════════════════════════════════════
  //  ROWS 11+ – data rows
  // ════════════════════════════════════════════════════════════════════════════
  data.forEach((emp, index) => {
    const rowNum = TABLE_HEADER_ROW + 1 + index;
    const isTop = index === 0;
    const isEven = index % 2 === 0;
    const rowBg = isTop
      ? COLOR.topBg
      : isEven
        ? COLOR.tableEvenRowBg
        : COLOR.tableOddRowBg;

    const rate = emp.completionRate ?? 0;
    const rateDisplay = rate / 100; // ExcelJS formats 0.x as % with numFmt "0%"

    const rateBg =
      rate >= 80 ? COLOR.greenBg : rate >= 50 ? COLOR.yellowBg : COLOR.redBg;
    const rateText =
      rate >= 80
        ? COLOR.greenText
        : rate >= 50
          ? COLOR.yellowText
          : COLOR.redText;

    const row = ws.getRow(rowNum);

    // ── column A: rank ──────────────────────────────────────────────────────
    applyCell(row.getCell(1), {
      value: isTop ? "👑" : index + 1,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: isTop,
        color: { argb: isTop ? COLOR.topAccent : COLOR.gray700 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
    });

    // ── column B: name ───────────────────────────────────────────────────────
    applyCell(row.getCell(2), {
      value: emp.fullName,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: isTop,
        color: { argb: isTop ? COLOR.topAccent : COLOR.gray900 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "left", vertical: "middle", indent: 1 },
      border: lightBorder(),
    });

    // ── column C: totalAppointments ─────────────────────────────────────────
    applyCell(row.getCell(3), {
      value: emp.totalAppointments,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: isTop,
        color: { argb: COLOR.gray700 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
      numFmt: "#,##0",
    });

    // ── column D: completed ─────────────────────────────────────────────────
    applyCell(row.getCell(4), {
      value: emp.completed,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: isTop,
        color: { argb: COLOR.gray700 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
      numFmt: "#,##0",
    });

    // ── column E: completion rate ────────────────────────────────────────────
    applyCell(row.getCell(5), {
      value: rateDisplay,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: rateText },
      },
      fill: solidFill(rateBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
      numFmt: "0%",
    });

    // ── column F: totalProperties ────────────────────────────────────────────
    applyCell(row.getCell(6), {
      value: emp.totalProperties ?? 0,
      font: {
        name: "Segoe UI",
        size: 10,
        color: { argb: COLOR.gray700 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
      numFmt: "#,##0",
    });

    // ── column G: score ──────────────────────────────────────────────────────
    const score = emp.score ?? 0;
    const scoreBg =
      score >= 70 ? COLOR.greenBg : score >= 40 ? COLOR.yellowBg : COLOR.redBg;
    const scoreText =
      score >= 70
        ? COLOR.greenText
        : score >= 40
          ? COLOR.yellowText
          : COLOR.redText;
    applyCell(row.getCell(7), {
      value: score,
      font: {
        name: "Segoe UI",
        size: 10,
        bold: score >= 70,
        color: { argb: scoreText },
      },
      fill: solidFill(emp.score !== undefined ? scoreBg : rowBg),
      alignment: { horizontal: "center", vertical: "middle" },
      border: lightBorder(),
      numFmt: "#,##0",
    });

    // ── column H: status ─────────────────────────────────────────────────────
    applyCell(row.getCell(8), {
      value: mapStatus(emp.activityStatus),
      font: {
        name: "Segoe UI",
        size: 10,
        color: { argb: COLOR.gray700 },
      },
      fill: solidFill(rowBg),
      alignment: { horizontal: "left", vertical: "middle", indent: 1 },
      border: lightBorder(),
    });

    row.height = 24;
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  POST-TABLE: total / summary row
  // ════════════════════════════════════════════════════════════════════════════
  const totalRowNum = TABLE_HEADER_ROW + 1 + data.length;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 28;

  const totalAppointments = data.reduce((s, e) => s + e.totalAppointments, 0);
  const totalCompleted = data.reduce((s, e) => s + e.completed, 0);
  const avgRate = data.length
    ? data.reduce((s, e) => s + (e.completionRate ?? 0), 0) / data.length / 100
    : 0;

  const totalCells: [number, ExcelJS.CellValue, string, string?][] = [
    [1, "TỔNG", "left"],
    [2, `${data.length} NV`, "center"],
    [3, totalAppointments, "center", "#,##0"],
    [4, totalCompleted, "center", "#,##0"],
    [5, avgRate, "center", "0%"],
    [6, null, "center"],
    [7, null, "center"],
    [8, null, "center"],
  ];

  totalCells.forEach(([col, val, align, fmt]) => {
    const cell = totalRow.getCell(col as number);
    applyCell(cell, {
      value: val ?? "",
      font: {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: COLOR.white },
      },
      fill: solidFill(COLOR.tableHeaderBg),
      alignment: {
        horizontal: align as "left" | "center",
        vertical: "middle",
        indent: align === "left" ? 1 : 0,
      },
      border: lightBorder(COLOR.tableHeaderBg),
      ...(fmt ? { numFmt: fmt } : {}),
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  FREEZE panes & auto filter
  // ════════════════════════════════════════════════════════════════════════════
  ws.views = [
    {
      state: "frozen",
      ySplit: TABLE_HEADER_ROW, // freeze rows 1-10 (header visible while scrolling)
      xSplit: 0,
      topLeftCell: `A${TABLE_HEADER_ROW + 1}`,
      activeCell: `A${TABLE_HEADER_ROW + 1}`,
      showGridLines: true,
    },
  ];

  ws.autoFilter = {
    from: `A${TABLE_HEADER_ROW}`,
    to: `H${TABLE_HEADER_ROW}`,
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ════════════════════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `employee_report_${date}.xlsx`,
  );
};
