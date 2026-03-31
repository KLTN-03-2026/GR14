export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const PROPERTY_STATUS = {
    ACTIVE: 1,
    SOLD: 0,
} as const;

export const PROPERTY_STATUS_LABELS: Record<number, string> = {
    0: 'Đã bán',
    1: 'Hoạt động',
};

export const APPOINTMENT_STATUS = {
    PENDING: 0,
    APPROVED: 1,
    REJECTED: 2,
} as const;

export const APPOINTMENT_STATUS_LABELS: Record<number, string> = {
    0: 'Chờ duyệt',
    1: 'Đã duyệt',
    2: 'Từ chối',
};

export const APPOINTMENT_ACTUAL_STATUS = {
    NOT_MET: 0,
    MET: 1,
    CUSTOMER_NO_SHOW: 2,
    UNABLE_TO_PROCEED: 3,
} as const;

export const APPOINTMENT_ACTUAL_STATUS_LABELS: Record<number, string> = {
    0: 'Chưa gặp',
    1: 'Đã gặp',
    2: 'Khách không đến',
    3: 'Không thể thực hiện',
};

export const POST_STATUS = {
    PENDING: 1,
    APPROVED: 2,
    REJECTED: 3,
} as const;

export const POST_STATUS_LABELS: Record<number, string> = {
    1: 'Chờ duyệt',
    2: 'Đã duyệt',
    3: 'Từ chối',
};

export const USER_STATUS = {
    ACTIVE: 1,
    INACTIVE: 0,
} as const;

export const DIRECTIONS = [
    'Đông',
    'Tây',
    'Nam',
    'Bắc',
    'Đông Bắc',
    'Đông Nam',
    'Tây Bắc',
    'Tây Nam',
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

// ==================== VIP & PAYMENT ====================

export const PAYMENT_STATUS = {
    PENDING: 0,
    SUCCESS: 1,
    FAILED: 2,
    CANCELLED: 3,
} as const;

export const PAYMENT_STATUS_LABELS: Record<number, string> = {
    0: 'Chờ thanh toán',
    1: 'Thành công',
    2: 'Thất bại',
    3: 'Đã hủy',
};

export const SUBSCRIPTION_STATUS = {
    PENDING: 0,
    ACTIVE: 1,
    EXPIRED: 2,
    CANCELLED: 3,
} as const;

export const SUBSCRIPTION_STATUS_LABELS: Record<number, string> = {
    0: 'Chờ thanh toán',
    1: 'Đang hoạt động',
    2: 'Hết hạn',
    3: 'Đã hủy',
};
