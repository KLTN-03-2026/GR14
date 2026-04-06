import apiClient from "./client";

export const analyticsApi = {
  // Summary KPI
  getSummary: () =>
    apiClient.get("/admin/analytics/summary").then((r) => r.data),

  // User analytics
  getUserGrowth: (type: "day" | "month" | "year") =>
    apiClient
      .get(`/admin/analytics/users/growth?type=${type}`)
      .then((r) => r.data),
  getDAU: () => apiClient.get("/admin/analytics/users/dau").then((r) => r.data),
  getMAU: () => apiClient.get("/admin/analytics/users/mau").then((r) => r.data),
  getRetention: (days: 1 | 7 | 30) =>
    apiClient
      .get(`/admin/analytics/users/retention?days=${days}`)
      .then((r) => r.data),

  // Post analytics
  getPostFunnel: () =>
    apiClient.get("/admin/analytics/posts/funnel").then((r) => r.data),
  getPostByTime: (type: "day" | "month" | "year") =>
    apiClient
      .get(`/admin/analytics/posts/time?type=${type}`)
      .then((r) => r.data),
  getApprovalRate: () =>
    apiClient.get("/admin/analytics/posts/approval-rate").then((r) => r.data),
  getVipActive: () =>
    apiClient.get("/admin/analytics/posts/vip").then((r) => r.data),
  getVipGrowth: (type: "day" | "month" | "year") =>
    apiClient
      .get(`/admin/analytics/posts/vip-growth?type=${type}`)
      .then((r) => r.data),

  // Revenue analytics
  getRevenue: (type: "day" | "month" | "year") =>
    apiClient.get(`/admin/analytics/revenue?type=${type}`).then((r) => r.data),
  getTransactionsByStatus: (type: "day" | "month") =>
    apiClient
      .get(`/admin/analytics/revenue/transactions?type=${type}`)
      .then((r) => r.data),
  getRevenueByGateway: () =>
    apiClient.get("/admin/analytics/revenue/gateway").then((r) => r.data),
  getRevenueByPackage: () =>
    apiClient.get("/admin/analytics/revenue/package").then((r) => r.data),
  getTopSpenders: () =>
    apiClient.get("/admin/analytics/revenue/top-spender").then((r) => r.data),

  // Appointment analytics
  getAppointments: (type: "day" | "month" | "year") =>
    apiClient
      .get(`/admin/analytics/appointments?type=${type}`)
      .then((r) => r.data),
  getAppointmentRates: () =>
    apiClient.get("/admin/analytics/appointments/rates").then((r) => r.data),
  getEmployeePerformance: () =>
    apiClient
      .get("/admin/analytics/appointments/performance")
      .then((r) => r.data),
  getHeatmap: () =>
    apiClient.get("/admin/analytics/appointments/heatmap").then((r) => r.data),

  // Behavior analytics
  getFavoriteTrend: (type: "day" | "month" | "year") =>
    apiClient
      .get(`/admin/analytics/favorites?type=${type}`)
      .then((r) => r.data),
  getTopLocations: () =>
    apiClient.get("/admin/analytics/locations").then((r) => r.data),
  compareHouseLand: () =>
    apiClient.get("/admin/analytics/compare").then((r) => r.data),
  compareHouseLandMonthly: () =>
    apiClient.get("/admin/analytics/compare/monthly").then((r) => r.data),
};
