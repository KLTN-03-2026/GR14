/**
 * ==================== USER PROFILE SERVICE ====================
 * Phân tích hành vi user → xây dựng hồ sơ sở thích → tạo bộ lọc ứng viên.
 * Xử lý cold-start (user mới chưa có hành vi) bằng BĐS phổ biến/mới đăng.
 *
 * Chức năng:
 *   1. buildUserProfile()        → Tính giá TB, khu vực hay xem, loại BĐS hay xem
 *   2. buildCandidateFilters()   → Tạo điều kiện WHERE cho Prisma query
 *   3. fetchInteractedProperties() → Lấy thông tin BĐS user đã tương tác
 *   4. getPopularHouses/Lands()  → Fallback: BĐS phổ biến cho user mới
 *   5. getPopularMixed()         → Trộn nhà + đất phổ biến (cold-start)
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  UserProfile,
  WeightedInteraction,
  WeightedItem,
  InteractedProperty,
} from '../interfaces/recommendation.interfaces';
import { QUERY_LIMITS } from '../constants/recommendation.constants';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xây dựng hồ sơ sở thích user từ danh sách BĐS đã tương tác.
   *
   * Input: Danh sách BĐS kèm trọng số (weight)
   *   VD: [
   *     { price: 3 tỷ, city: "HCM", district: "Q7", categoryId: 1, weight: 3 },  ← save
   *     { price: 5 tỷ, city: "HCM", district: "Q7", categoryId: 1, weight: 2 },  ← click
   *     { price: 4 tỷ, city: "HN",  district: "CG", categoryId: 2, weight: 2 },  ← click
   *   ]
   *
   * Output: UserProfile = {
   *   avgPrice: (3×3 + 5×2 + 4×2) / (3+2+2) = 27/7 = 3.86 tỷ,
   *   avgArea: ...,
   *   locationCounts: { "HCM|Q7": 5, "HN|CG": 2 },
   *   categoryCounts: { 1: 5, 2: 2 },
   *   totalWeight: 7
   * }
   */
  buildUserProfile(items: WeightedItem[]): UserProfile {
    // Tổng trọng số tất cả tương tác
    const totalWeight = items.reduce((sum, h) => sum + h.weight, 0);

    // ═══ Giá trung bình CÓ TRỌNG SỐ ═══
    // Không dùng trung bình đơn giản vì: save (w=3) quan trọng hơn click (w=2)
    // Công thức: avg = Σ(giá × weight) / Σ(weight)
    const prices = items
      .filter((h) => h.price)
      .map((h) => ({
        value: Number(h.price),
        weight: h.weight,
      }));
    const avgPrice =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p.value * p.weight, 0) /
          prices.reduce((sum, p) => sum + p.weight, 0)
        : 0;

    // ═══ Tần suất khu vực (có trọng số) ═══
    // Đếm user xem khu vực nào nhiều nhất
    // VD: Xem Q7 3 lần (save=3, click=2) → locationCounts["HCM|Q7"] = 3+2 = 5
    const locationCounts: Record<string, number> = {};
    items.forEach((h) => {
      if (h.city && h.district) {
        const key = `${h.city}|${h.district}`;
        locationCounts[key] = (locationCounts[key] || 0) + h.weight;
      }
    });

    // ═══ Tần suất loại BĐS (có trọng số) ═══
    // VD: Xem "nhà phố" (catId=1) 5 lần, "chung cư" (catId=2) 2 lần
    const categoryCounts: Record<number, number> = {};
    items.forEach((h) => {
      if (h.categoryId) {
        categoryCounts[h.categoryId] =
          (categoryCounts[h.categoryId] || 0) + h.weight;
      }
    });

    // ═══ Diện tích trung bình CÓ TRỌNG SỐ ═══
    const areas = items
      .filter((h) => h.area)
      .map((h) => ({
        value: Number(h.area),
        weight: h.weight,
      }));
    const avgArea =
      areas.length > 0
        ? areas.reduce((sum, a) => sum + a.value * a.weight, 0) /
          areas.reduce((sum, a) => sum + a.weight, 0)
        : 0;

    return { avgPrice, avgArea, locationCounts, categoryCounts, totalWeight };
  }

  /**
   * Tạo bộ lọc Prisma WHERE từ hồ sơ sở thích user.
   * Các điều kiện nối bằng OR: chỉ cần thỏa 1 điều kiện là được chọn.
   *
   * VD: Profile = { avgPrice: 4 tỷ, locationCounts: {"HCM|Q7": 5}, categoryCounts: {1: 5} }
   * → filters = [
   *     { price: { gte: 2 tỷ, lte: 6 tỷ } },    ← Giá ±50%
   *     { city: "HCM", district: "Q7" },           ← Khu vực yêu thích
   *     { categoryId: { in: [1] } },               ← Loại BĐS yêu thích
   *     { area: { gte: 50, lte: 150 } },           ← Diện tích ±50%
   *   ]
   * → Prisma WHERE: OR: [điều_kiện_1, điều_kiện_2, ...]
   */
  buildCandidateFilters(profile: UserProfile): any[] {
    const filters: any[] = [];

    // ═══ Lọc giá ±50% ═══
    // User thích 4 tỷ → lọc BĐS từ 2 tỷ đến 6 tỷ
    if (profile.avgPrice > 0) {
      filters.push({
        price: {
          gte: Math.round(
            profile.avgPrice * (1 - QUERY_LIMITS.PRICE_RANGE_TOLERANCE),
          ),
          lte: Math.round(
            profile.avgPrice * (1 + QUERY_LIMITS.PRICE_RANGE_TOLERANCE),
          ),
        },
      });
    }

    // ═══ Lọc theo khu vực yêu thích (top 5) ═══
    // Sắp xếp khu vực theo trọng số giảm dần, lấy top 5
    const topLocations = Object.entries(profile.locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, QUERY_LIMITS.TOP_LOCATION_LIMIT);
    for (const [key] of topLocations) {
      const [city, district] = key.split('|');
      filters.push({ city, district });
    }

    // ═══ Lọc theo loại BĐS yêu thích (top 5) ═══
    const topCategories = Object.entries(profile.categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, QUERY_LIMITS.TOP_CATEGORY_LIMIT)
      .map(([id]) => Number(id));
    if (topCategories.length > 0) {
      filters.push({ categoryId: { in: topCategories } });
    }

    // ═══ Lọc diện tích ±50% ═══
    if (profile.avgArea > 0) {
      filters.push({
        area: {
          gte: Math.round(
            profile.avgArea * (1 - QUERY_LIMITS.AREA_RANGE_TOLERANCE),
          ),
          lte: Math.round(
            profile.avgArea * (1 + QUERY_LIMITS.AREA_RANGE_TOLERANCE),
          ),
        },
      });
    }

    // Nếu không có bộ lọc nào → trả [{}] (không giới hạn, lấy tất cả)
    return filters.length > 0 ? filters : [{}];
  }

  /**
   * Lấy thông tin chi tiết BĐS mà user đã tương tác.
   * Dùng để build UserProfile trong luồng AI Recommendation.
   *
   * Input: [{id: 5, type: "house"}, {id: 3, type: "land"}]
   * Output: [{id: 5, type: "house", price: 3tỷ, city: "HCM", ...}, ...]
   */
  async fetchInteractedProperties(
    interactions: WeightedInteraction[],
  ): Promise<InteractedProperty[]> {
    // Tách ID nhà và đất
    const houseIds = interactions
      .filter((i) => i.type === 'house')
      .map((i) => i.id);
    const landIds = interactions
      .filter((i) => i.type === 'land')
      .map((i) => i.id);

    // Query song song (Promise.all) để nhanh hơn
    const [houses, lands] = await Promise.all([
      houseIds.length > 0
        ? this.prisma.house.findMany({
            where: { id: { in: houseIds } },
            select: {
              id: true,
              price: true,
              city: true,
              district: true,
              area: true,
              categoryId: true,
            },
          })
        : Promise.resolve([]),
      landIds.length > 0
        ? this.prisma.land.findMany({
            where: { id: { in: landIds } },
            select: {
              id: true,
              price: true,
              city: true,
              district: true,
              area: true,
              categoryId: true,
              landType: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // Gộp và đánh dấu type
    return [
      ...houses.map((h) => ({ ...h, type: 'house' as const })),
      ...lands.map((l) => ({ ...l, type: 'land' as const })),
    ];
  }

  /**
   * Lấy danh sách NHÀ phổ biến nhất (nhiều lượt yêu thích).
   * Đây là fallback cho user mới chưa có hành vi (cold-start problem).
   *
   * Ưu tiên: BĐS nhiều favorite nhất → nếu không có → BĐS mới đăng nhất.
   */
  async getPopularHouses(limit: number) {
    // Đếm lượt yêu thích, sắp xếp giảm dần
    const popularIds = await this.prisma.favorite.groupBy({
      by: ['houseId'],
      where: { houseId: { not: null } },
      _count: { houseId: true },
      orderBy: { _count: { houseId: 'desc' } },
      take: limit,
    });

    // Nếu có BĐS được yêu thích → trả về kèm reason "Được nhiều người quan tâm"
    if (popularIds.length > 0) {
      const houses = await this.prisma.house.findMany({
        where: {
          id: { in: popularIds.map((p) => p.houseId!).filter(Boolean) },
          status: 1, // Chỉ BĐS đang active
        },
        include: {
          images: { select: { id: true, url: true } },
          category: true,
          employee: {
            include: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
        },
      });
      return houses.map((h) => ({
        ...h,
        recommendationScore: 0.5,
        recommendationReason: 'Được nhiều người quan tâm',
      }));
    }

    // Không ai yêu thích BĐS nào → trả BĐS mới đăng nhất
    const houses = await this.prisma.house.findMany({
      where: { status: 1 },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { select: { id: true, url: true } },
        category: true,
        employee: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    });
    return houses.map((h) => ({
      ...h,
      recommendationScore: 0.4,
      recommendationReason: 'Mới đăng gần đây',
    }));
  }

  /**
   * Lấy danh sách ĐẤT phổ biến nhất — tương tự getPopularHouses().
   */
  async getPopularLands(limit: number) {
    const popularIds = await this.prisma.favorite.groupBy({
      by: ['landId'],
      where: { landId: { not: null } },
      _count: { landId: true },
      orderBy: { _count: { landId: 'desc' } },
      take: limit,
    });

    if (popularIds.length > 0) {
      const lands = await this.prisma.land.findMany({
        where: {
          id: { in: popularIds.map((p) => p.landId!).filter(Boolean) },
          status: 1,
        },
        include: {
          images: { select: { id: true, url: true } },
          category: true,
          employee: {
            include: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
        },
      });
      return lands.map((l) => ({
        ...l,
        recommendationScore: 0.5,
        recommendationReason: 'Được nhiều người quan tâm',
      }));
    }

    const lands = await this.prisma.land.findMany({
      where: { status: 1 },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { select: { id: true, url: true } },
        category: true,
        employee: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    });
    return lands.map((l) => ({
      ...l,
      recommendationScore: 0.4,
      recommendationReason: 'Mới đăng gần đây',
    }));
  }

  /**
   * Trộn nhà + đất phổ biến xen kẽ (cold-start fallback cho AI endpoint).
   *
   * VD: limit=6 → lấy 3 nhà + 3 đất, xen kẽ:
   *     [nhà1, đất1, nhà2, đất2, nhà3, đất3]
   */
  async getPopularMixed(limit: number) {
    const houseLimit = Math.ceil(limit / 2); // Chia đều
    const landLimit = limit - houseLimit;

    const [houses, lands] = await Promise.all([
      this.getPopularHouses(houseLimit),
      this.getPopularLands(landLimit),
    ]);

    // Gắn thêm propertyType để frontend phân biệt nhà/đất
    const mixed = [
      ...houses.map((h: any) => ({ ...h, propertyType: 'house' })),
      ...lands.map((l: any) => ({ ...l, propertyType: 'land' })),
    ];

    // Xen kẽ nhà - đất - nhà - đất (không gom tất cả nhà rồi tất cả đất)
    const result: any[] = [];
    let hi = 0,
      li = 0;
    const hList = mixed.filter((m) => m.propertyType === 'house');
    const lList = mixed.filter((m) => m.propertyType === 'land');

    while (result.length < limit && (hi < hList.length || li < lList.length)) {
      if (hi < hList.length) result.push(hList[hi++]);
      if (li < lList.length && result.length < limit) result.push(lList[li++]);
    }

    return result;
  }
}
