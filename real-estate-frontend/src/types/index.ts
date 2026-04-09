// ==================== USER & AUTH ====================

export interface User {
    id: number;
    username: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    status: number;
    isVip?: boolean;
    vipExpiry?: string; // ISO date string
    vipPackageName?: string | null;
    vipPriorityLevel?: number | null;
    vipDurationDays?: number | null;
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
    city?: string;
    district?: string;
    maxAppointmentsPerDay?: number;
    isActive?: boolean;
    lastAssignedAt?: string;
    userId: number;
    createdAt: string;
    updatedAt: string;
    user?: User;
    availabilities?: EmployeeAvailability[];
}

export interface EmployeeAvailability {
    id: number;
    employeeId: number;
    startAt: string;
    endAt: string;
    type: 'available' | 'blocked';
    createdAt: string;
    updatedAt: string;
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
    durationMinutes?: number;
    assignedAt?: string;
    firstContactAt?: string;
    slaAssignDeadlineAt?: string;
    slaFirstContactDeadlineAt?: string;
    slaStatus?: number; // 0: on_track, 1: at_risk, 2: breached
    autoAssignReason?: string;
    status: number; // 0: pending, 1: approved, 2: rejected
    actualStatus?: number;
    cancelReason?: string;
    createdAt: string;
    updatedAt: string;
    house?: Pick<House, 'id' | 'title' | 'city' | 'district'> & { images?: Pick<HouseImage, 'id' | 'url'>[] };
    land?: Pick<Land, 'id' | 'title' | 'city' | 'district'> & { images?: Pick<LandImage, 'id' | 'url'>[] };
    customer?: Customer;
    employee?: Employee;
}

export interface AppointmentCalendarEvent {
    id: number;
    title: string;
    start: string;
    end: string;
    allDay?: boolean;
    extendedProps?: {
        employeeId?: number;
        employeeName?: string;
        customerName?: string;
        durationMinutes?: number;
        location?: string;
    };
}

// ==================== POST ====================

export interface Post {
    id: number;
    postType: string;
    title: string;

    // Common fields
    city?: string;
    district?: string;
    ward?: string;
    address?: string;
    contactPhone?: string;
    contactLink?: string;
    description: string;
    direction?: string;

    // BĐS fields (SELL/RENT HOUSE/LAND)
    price?: number;
    area?: number;

    // House fields (SELL_HOUSE, RENT_HOUSE)
    bedrooms?: number;
    bathrooms?: number;
    floors?: number;

    // Land fields (SELL_LAND, RENT_LAND)
    frontWidth?: number;
    landLength?: number;
    landType?: string;
    legalStatus?: string;

    // NEED_BUY/NEED_RENT fields
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;

    // NEWS/PROMOTION fields
    startDate?: string;
    endDate?: string;
    discountCode?: string;

    // Status and VIP
    status: number;
    isVip?: boolean;
    vipExpiry?: string;
    vipPackageName?: string;
    vipPriorityLevel?: number;
    vipSubscriptionStatus?: number | null;

    // User and timestamps
    userId: number;
    postedAt: string;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;

    // Relations
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

// ==================== RECOMMENDATION ====================

export interface RecommendedHouse extends House {
    recommendationScore: number;
    recommendationReason: string;
}

export interface RecommendedLand extends Land {
    recommendationScore: number;
    recommendationReason: string;
}

export interface AIRecommendation {
    id: number;
    propertyType: 'house' | 'land';
    title: string;
    city?: string;
    district?: string;
    ward?: string;
    street?: string;
    price?: number;
    area?: number;
    direction?: string;
    status: number;
    createdAt: string;
    images?: Array<{ id: number; url: string }>;
    category?: PropertyCategory;
    employee?: { id: number; user: { id: number; fullName: string; phone: string } };
    recommendationScore: number;
    recommendationReason: string;
    embeddingScore: number;
    ruleScore: number;
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
    address?: string;
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
    postId?: number; // Optional - for POST_VIP or null for ACCOUNT_VIP
    packageId: number;
    paymentType: 'POST_VIP' | 'ACCOUNT_VIP';
    paymentMethod: 'vnpay' | 'momo' | 'MOCK';
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
