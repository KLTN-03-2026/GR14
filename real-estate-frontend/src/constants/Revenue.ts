// ─────────────────────────────────────────────────────────────────────────────
// File: real-estate-frontend/src/constants/revenue.ts
// Thêm export vào real-estate-frontend/src/constants/index.ts
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  ACCOUNT_VIP:       'Account VIP',
  POST_VIP:          'Post VIP',
  PROPERTY_DEPOSIT:  'Đặt cọc',
};

export const PAYMENT_TYPE_CLASS: Record<string, string> = {
  ACCOUNT_VIP:       'bg-purple-50 text-purple-700',
  POST_VIP:          'bg-teal-50 text-teal-700',
  PROPERTY_DEPOSIT:  'bg-orange-50 text-orange-700',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  vnpay: 'VNPay',
  momo:  'MoMo',
  MOCK:  'Mock',
};

export const PAYMENT_METHOD_CLASS: Record<string, string> = {
  vnpay: 'bg-blue-50 text-blue-700',
  momo:  'bg-pink-50 text-pink-700',
  MOCK:  'bg-gray-100 text-gray-500',
};

export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  0: 'Chờ xử lý',
  1: 'Thành công',
  2: 'Thất bại',
};

export const PAYMENT_STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = {
  0: 'warning',
  1: 'success',
  2: 'error',
};

export const REVENUE_GROUP_BY_LABELS: Record<string, string> = {
  day:   'Theo ngày',
  month: 'Theo tháng',
  year:  'Theo năm',
};