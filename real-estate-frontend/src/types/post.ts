// Post Type Constants
export const PostType = {
  SELL_HOUSE: 'SELL_HOUSE',
  SELL_LAND: 'SELL_LAND',
  RENT_HOUSE: 'RENT_HOUSE',
  RENT_LAND: 'RENT_LAND',
  NEED_BUY: 'NEED_BUY',
  NEED_RENT: 'NEED_RENT',
  NEWS: 'NEWS',
  PROMOTION: 'PROMOTION',
} as const;

export type PostType = typeof PostType[keyof typeof PostType];

// Post Type Labels
export const POST_TYPE_LABELS: Record<PostType, string> = {
  [PostType.SELL_HOUSE]: 'Bán nhà',
  [PostType.SELL_LAND]: 'Bán đất',
  [PostType.RENT_HOUSE]: 'Cho thuê nhà',
  [PostType.RENT_LAND]: 'Cho thuê đất',
  [PostType.NEED_BUY]: 'Cần mua',
  [PostType.NEED_RENT]: 'Cần thuê',
  [PostType.NEWS]: 'Tin tức',
  [PostType.PROMOTION]: 'Khuyến mãi',
};

// Post Type Groups
export const POST_TYPE_GROUPS = {
  PROPERTY: [PostType.SELL_HOUSE, PostType.SELL_LAND, PostType.RENT_HOUSE, PostType.RENT_LAND],
  NEED: [PostType.NEED_BUY, PostType.NEED_RENT],
  CONTENT: [PostType.NEWS, PostType.PROMOTION],
};

export interface PostImage {
  id: number;
  url: string;
  position?: number;
}

export interface Post {
  id: number;
  postType: PostType;
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
  user?: {
    id: number;
    username: string;
    fullName: string;
    phone: string;
  };
  images?: PostImage[];
}

// Create Post DTO
export interface CreatePostDto {
  postType: PostType;
  title: string;
  description: string;

  // Common fields
  city?: string;
  district?: string;
  ward?: string;
  address?: string;
  contactPhone?: string;
  contactLink?: string;
  direction?: string;

  // BĐS fields
  price?: number;
  area?: number;

  // House fields
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;

  // Land fields
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
}

// Update Post DTO
export interface UpdatePostDto extends Partial<CreatePostDto> { }

// Post Status Constants
export const PostStatus = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
} as const;

export type PostStatus = typeof PostStatus[keyof typeof PostStatus];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  [PostStatus.PENDING]: 'Chờ duyệt',
  [PostStatus.APPROVED]: 'Đã duyệt',
  [PostStatus.REJECTED]: 'Từ chối',
};
