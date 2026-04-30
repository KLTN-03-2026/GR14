

import axiosInstance from './client'; // hoặc tên file axios của project

export type RevenueGroupBy = 'day' | 'month' | 'year';

export interface RevenueStatsParams {
  startDate?: string;
  endDate?:   string;
  groupBy?:   RevenueGroupBy;
}

export interface ChartDataPoint {
  label:      string;
  accountVip: number;
  postVip:    number;
  deposit:    number;
  total:      number;
}

export interface RevenueStats {
  summary: {
    totalRevenue: number;
    accountVip:   { revenue: number; count: number };
    postVip:      { revenue: number; count: number };
    deposit:      { revenue: number; count: number };
  };
  transactionStatus: {
    success:     number;
    failed:      number;
    pending:     number;
    total:       number;
    successRate: number;
  };
  methodBreakdown: Array<{
    method:  string;
    revenue: number;
    count:   number;
  }>;
  chartData: ChartDataPoint[];
  comparison: {
    currentPeriod:  { revenue: number; count: number };
    previousPeriod: { revenue: number; count: number };
    revenueChange:  number | null;
    countChange:    number | null;
  };
  period: {
    startDate: string;
    endDate:   string;
    groupBy:   RevenueGroupBy;
  };
}

export interface PaymentListParams {
  page?:      number;
  limit?:     number;
  search?:    string;
  method?:    string;
  status?:    string;
  type?:      string;
  startDate?: string;
  endDate?:   string;
}

export interface PaymentItem {
  id:            number;
  amount:        number;
  paymentMethod: string;
  paymentType:   string;
  status:        number;
  createdAt:     string;
  user?: {
    id:       number;
    fullName: string;
    email:    string;
  };
  subscription?: {
    package?: { id: number; name: string };
    post?:    { id: number; title: string };
  };
}

// src/api/revenue.ts
export const revenueApi = {
  getStats: (params?: RevenueStatsParams) =>
    axiosInstance.get<{ data: RevenueStats }>('/payment/admin/revenue', { params }),

  getPayments: (params?: PaymentListParams) =>
    axiosInstance.get<{
      data: PaymentItem[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>('/payment/admin/all', { params }),
};
