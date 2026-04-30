// src/types/deposit.ts

export type DepositType = 'BEFORE_VIEWING' | 'AFTER_VIEWING';

// 0: pending, 1: paid, 2: refund_requested, 3: refunded, 4: expired, 5: completed
export type DepositStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface CreateDepositRequest {
  appointmentId: number;
  amount: number;
  paymentMethod: 'vnpay' | 'momo' | 'MOCK';
  returnUrl: string;
}

export interface RequestRefundRequest {
  refundAccountInfo: string;
}

export interface DepositResponse {
  message: string;
  data: {
    depositId: number;
    paymentId: number;
    depositType: DepositType;
    expiresAt: string;
    paymentUrl: string;
    transactionId: string;
  };
}

export interface DepositPayment {
  id: number;
  status: number;
  paymentUrl: string | null;
  paidAt: string | null;
}

export interface DepositAppointment {
  id: number;
  appointmentDate: string;
  status: number;         // 0: pending, 1: approved, 2: rejected
  actualStatus: number | null;
  house?: {
    id: number;
    title: string;
    city?: string;
    district?: string;
    depositStatus: number;
    images?: { id: number; url: string }[];
  } | null;
  land?: {
    id: number;
    title: string;
    city?: string;
    district?: string;
    depositStatus: number;
    images?: { id: number; url: string }[];
  } | null;
}

export interface Deposit {
  id: number;
  appointmentId: number;
  userId: number;
  amount: string;           // Decimal từ Prisma trả về dạng string
  refundAmount: string | null;
  refundAccountInfo: string | null;
  depositType: DepositType;
  status: DepositStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  appointment: DepositAppointment;
  payment: DepositPayment | null;
}

export interface MyDepositsResponse {
  data: Deposit[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DepositDetail {
  id: number;
  appointmentId: number;
  userId: number;
  amount: string;
  refundAmount: string | null;
  refundAccountInfo: string | null;
  depositType: DepositType;
  status: DepositStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  appointment: DepositAppointment;
  payment: DepositPayment | null;
}

// ── Config hiển thị ───────────────────────────────────────────────────────────

export const DEPOSIT_STATUS_CFG: Record<
  DepositStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  0: { label: 'Chờ thanh toán',    dot: 'bg-gray-400',    text: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200' },
  1: { label: 'Đang giữ chỗ',      dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  2: { label: 'Chờ hoàn tiền',     dot: 'bg-orange-400',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  3: { label: 'Đã hoàn tiền',      dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  4: { label: 'Hết hạn / Mất cọc', dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  5: { label: 'Đã chốt mua',       dot: 'bg-purple-400',  text: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
};

export const APPOINTMENT_STATUS_CFG: Record<
  number,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  0: { label: 'Chờ duyệt',  dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  1: { label: 'Đã duyệt',   dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  2: { label: 'Đã từ chối', dot: 'bg-red-400',      text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};