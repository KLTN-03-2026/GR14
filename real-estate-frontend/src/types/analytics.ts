// src/types/analytics.ts
// All analytics-related types — single source of truth

// ─── Time ────────────────────────────────────────────
export type TimeType = "day" | "month" | "year";

// ─── Common chart shapes ──────────────────────────────
export interface TimeSeriesPoint {
  time: string;
  total: number;
}

// ─── Summary KPI ──────────────────────────────────────
export interface SummaryKPI {
  totalUsers: number;
  newUsersThisMonth: number;
  userGrowth: number | null;
  totalPosts: number;
  newPostsThisMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number | null;
  totalAppointments: number;
  appointmentsThisMonth: number;
}

// ─── User Growth ──────────────────────────────────────
export interface DAUPoint {
  date: string;
  total: number;
}

export interface MAUPoint {
  month: string;
  total: number;
}

export interface RetentionResult {
  days: number;
  retained: number;
  total: number;
  rate: number;
}

// ─── Posts ────────────────────────────────────────────
export interface PostFunnelItem {
  status: number;
  label: string;
  total: number;
}

export interface ApprovalRate {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
}

export interface VipActive {
  activeVip: number;
}

// ─── Revenue ──────────────────────────────────────────
export interface RevenuePoint {
  time: string;
  total: number;
}

export interface GatewayRevenue {
  gateway: string;
  revenue: number;
  transactions: number;
}

export interface PackageRevenue {
  name: string;
  days: number;
  total: number;
  count: number;
}

export interface TopSpender {
  rank: number;
  userId: number;
  fullName: string;
  email: string;
  totalSpent: number;
  transactions: number;
}

// ─── Appointments ────────────────────────────────────
export interface AppointmentRates {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  approvalRate: number;
  rejectionRate: number;
  completionRate: number;
}

export interface EmployeePerformance {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  totalAppointments: number;
  completed: number;
  completionRate: number;
}

export interface HeatmapPoint {
  hour: number;
  label: string;
  total: number;
}

// ─── Behavior ────────────────────────────────────────
export interface LocationStat {
  city: string;
  houses: number;
  lands: number;
  total: number;
}

export interface PropertyComparison {
  type: "Nhà" | "Đất";
  total: number;
}

export interface MonthlyComparison {
  time: string;
  house: number;
  land: number;
}

// ─── Analytics Context ───────────────────────────────
export interface AnalyticsContextValue {
  timeType: TimeType;
}
