// ==================== USER & AUTH ====================

export interface User {
    id: number;
    username: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    status: number;
    createdAt: string;
    updatedAt: string;
    roles?: string[];
    employeeId?: number | null;
    customer?: Customer;
    employee?: Employee;
    userRoles?: UserRole[];
}

export interface Role {
    id: number;
    code: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserRole {
    id: number;
    userId: number;
    roleId: number;
    role?: Role;
    user?: User;
}

// ==================== CUSTOMER & EMPLOYEE ====================

export interface Customer {
    id: number;
    code: string;
    userId: number;
    createdAt: string;
    updatedAt: string;
    user?: User;
}

export interface Employee {
    id: number;
    code: string;
    startDate?: string;
    userId: number;
    createdAt: string;
    updatedAt: string;
    user?: User;
}

// ==================== PROPERTY ====================

export interface PropertyCategory {
    id: number;
    code: string;
    name: string;
}

export interface House {
    id: number;
    code: string;
    title: string;
    city?: string;
    district?: string;
    ward?: string;
    street?: string;
    houseNumber?: string;
    description?: string;
    price?: number;
    area?: number;
    direction?: string;
    floors?: number;
    bedrooms?: number;
    bathrooms?: number;
    status: number;
    categoryId?: number;
    employeeId?: number;
    createdAt: string;
    updatedAt: string;
    category?: PropertyCategory;
    employee?: Employee;
    images?: HouseImage[];
}

export interface HouseImage {
    id: number;
    url: string;
    type?: string;
    position?: number;
    houseId: number;
}

export interface Land {
    id: number;
    code: string;
    title: string;
    city?: string;
    district?: string;
    ward?: string;
    street?: string;
    plotNumber?: string;
    description?: string;
    price?: number;
    area?: number;
    direction?: string;
    frontWidth?: number;
    landLength?: number;
    landType?: string;
    legalStatus?: string;
    status: number;
    categoryId?: number;
    employeeId?: number;
    createdAt: string;
    updatedAt: string;
    category?: PropertyCategory;
    employee?: Employee;
    images?: LandImage[];
}

export interface LandImage {
    id: number;
    url: string;
    type?: string;
    position?: number;
    landId: number;
}

// ==================== APPOINTMENT ====================

export interface Appointment {
    id: number;
    houseId?: number;
    landId?: number;
    customerId: number;
    employeeId?: number;
    appointmentDate: string;
    status: number; // 0: pending, 1: approved, 2: rejected
    actualStatus?: number;
    cancelReason?: string;
    createdAt: string;
    updatedAt: string;
    house?: Pick<House, 'id' | 'title' | 'city' | 'district'>;
    land?: Pick<Land, 'id' | 'title' | 'city' | 'district'>;
    customer?: Customer;
    employee?: Employee;
}

// ==================== POST ====================

export interface Post {
    id: number;
    title: string;
    city: string;
    district: string;
    ward: string;
    address: string;
    description: string;
    price: number;
    area: number;
    direction?: string;
    status: number;
    isVip?: boolean;
    vipExpiry?: string;
    vipPackageName?: string;
    vipPriorityLevel?: number;
    userId: number;
    postedAt: string;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;
    user?: User;
    images?: PostImage[];
}

export interface PostImage {
    id: number;
    url: string;
    position?: number;
    postId: number;
}

// ==================== FAVORITE ====================

export interface Favorite {
    id: number;
    userId: number;
    houseId?: number;
    landId?: number;
    createdAt: string;
    house?: House;
    land?: Land;
}

// ==================== API RESPONSE ====================

export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

// ==================== AUTH ====================

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    fullName?: string;
    phone?: string;
    email?: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    email: string;
    otp: string;
    newPassword: string;
}

// ==================== VIP PACKAGE & PAYMENT ====================

export interface VipPackage {
    id: number;
    name: string;
    description?: string;
    durationDays: number;
    price: number;
    priorityLevel: number;
    features?: string;
    status: number;
    createdAt: string;
    updatedAt: string;
}

export interface VipSubscription {
    id: number;
    postId: number;
    packageId: number;
    userId: number;
    startDate?: string;
    endDate?: string;
    status: number; // 0: pending, 1: active, 2: expired, 3: cancelled
    createdAt: string;
    updatedAt: string;
    package?: VipPackage;
    post?: Post;
    payment?: Payment;
}

export interface Payment {
    id: number;
    subscriptionId: number;
    userId: number;
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    status: number; // 0: pending, 1: success, 2: failed, 3: cancelled
    paymentUrl?: string;
    paidAt?: string;
    createdAt: string;
    updatedAt: string;
    subscription?: VipSubscription;
}

export interface CreatePaymentRequest {
    postId: number;
    packageId: number;
    paymentMethod: 'vnpay' | 'momo';
    returnUrl: string;
}

export interface CreatePaymentResponse {
    message: string;
    data: {
        paymentId: number;
        subscriptionId: number;
        paymentUrl: string;
        amount: number;
    };
}
