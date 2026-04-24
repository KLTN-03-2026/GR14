// src/utils/excelStyles.ts
// SheetJS-compatible cell style objects.
// ⚠️  Styles only render when using `xlsx-style` or `@sheetjs/pro`.
//     With the free `xlsx` package the data/structure is still correct,
//     just without visual formatting.

// ─── Fonts ────────────────────────────────────────────
const FONT_BASE = { name: "Arial", sz: 11 };
const FONT_TITLE = { ...FONT_BASE, sz: 16, bold: true };
const FONT_HEADER = {
  ...FONT_BASE,
  sz: 11,
  bold: true,
  color: { rgb: "FFFFFF" },
};
const FONT_META = {
  ...FONT_BASE,
  sz: 10,
  italic: true,
  color: { rgb: "555555" },
};
const FONT_KPI_LABEL = {
  ...FONT_BASE,
  sz: 10,
  bold: true,
  color: { rgb: "1A56DB" },
};
const FONT_KPI_VALUE = { ...FONT_BASE, sz: 13, bold: true };
const FONT_TOP = { ...FONT_BASE, sz: 11, bold: true };
const FONT_NORMAL = FONT_BASE;

// ─── Fills ────────────────────────────────────────────
const FILL_HEADER = {
  patternType: "solid",
  fgColor: { rgb: "1A56DB" }, // blue
};
const FILL_TOP_PERFORMER = {
  patternType: "solid",
  fgColor: { rgb: "FFF9C4" }, // light yellow
};
const FILL_KPI_BG = {
  patternType: "solid",
  fgColor: { rgb: "EBF5FB" }, // very light blue
};
const FILL_SECTION_TITLE = {
  patternType: "solid",
  fgColor: { rgb: "F0F4FF" },
};

// ─── Borders ──────────────────────────────────────────
const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "D0D0D0" } },
  bottom: { style: "thin", color: { rgb: "D0D0D0" } },
  left: { style: "thin", color: { rgb: "D0D0D0" } },
  right: { style: "thin", color: { rgb: "D0D0D0" } },
};
const BORDER_MEDIUM_BOTTOM = {
  ...BORDER_THIN,
  bottom: { style: "medium", color: { rgb: "1A56DB" } },
};

// ─── Alignments ──────────────────────────────────────
const ALIGN_CENTER = {
  horizontal: "center",
  vertical: "center",
};
const ALIGN_LEFT = {
  horizontal: "left",
  vertical: "center",
};
const ALIGN_RIGHT = {
  horizontal: "right",
  vertical: "center",
};

// ─── Exported style presets ───────────────────────────
export const STYLES = {
  title: {
    font: FONT_TITLE,
    alignment: ALIGN_CENTER,
  },

  meta: {
    font: FONT_META,
    alignment: ALIGN_LEFT,
  },

  kpiLabel: {
    font: FONT_KPI_LABEL,
    fill: FILL_KPI_BG,
    alignment: ALIGN_CENTER,
    border: BORDER_THIN,
  },

  kpiValue: {
    font: FONT_KPI_VALUE,
    fill: FILL_KPI_BG,
    alignment: ALIGN_CENTER,
    border: BORDER_THIN,
  },

  sectionTitle: {
    font: { ...FONT_BASE, sz: 12, bold: true },
    fill: FILL_SECTION_TITLE,
    alignment: ALIGN_LEFT,
    border: BORDER_MEDIUM_BOTTOM,
  },

  tableHeader: {
    font: FONT_HEADER,
    fill: FILL_HEADER,
    alignment: ALIGN_CENTER,
    border: BORDER_THIN,
  },

  tableRowNormal: {
    font: FONT_NORMAL,
    alignment: ALIGN_LEFT,
    border: BORDER_THIN,
  },

  tableRowTop: {
    font: FONT_TOP,
    fill: FILL_TOP_PERFORMER,
    alignment: ALIGN_LEFT,
    border: BORDER_THIN,
  },

  tableNumber: {
    font: FONT_NORMAL,
    alignment: ALIGN_RIGHT,
    border: BORDER_THIN,
  },

  tableNumberTop: {
    font: FONT_TOP,
    fill: FILL_TOP_PERFORMER,
    alignment: ALIGN_RIGHT,
    border: BORDER_THIN,
  },

  tableCenter: {
    font: FONT_NORMAL,
    alignment: ALIGN_CENTER,
    border: BORDER_THIN,
  },

  tableCenterTop: {
    font: FONT_TOP,
    fill: FILL_TOP_PERFORMER,
    alignment: ALIGN_CENTER,
    border: BORDER_THIN,
  },
} as const;

// ─── Column widths for the main sheet ────────────────
export const MAIN_COL_WIDTHS = [
  { wch: 5 }, // #
  { wch: 22 }, // Nhân viên
  { wch: 12 }, // Tổng lịch
  { wch: 13 }, // Hoàn thành
  { wch: 10 }, // %
  { wch: 10 }, // BĐS
  { wch: 9 }, // Score
  { wch: 13 }, // Trạng thái
];

export const ANALYSIS_COL_WIDTHS = [{ wch: 28 }, { wch: 45 }];
