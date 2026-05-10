/**
 * ==================== RECOMMENDATION SERVICE (ORCHESTRATOR) ====================
 * File chính điều phối toàn bộ hệ thống gợi ý BĐS.
 * Gọi 3 sub-services: ScoringService, VectorService, UserProfileService.
 *
 * Luồng:
 *   1. getAIRecommendations()    → Hybrid (AI + Rules), trả nhà + đất xen kẽ
 *   2. getHouseRecommendations() → Rule-based, chỉ trả nhà
 *   3. getLandRecommendations()   → Rule-based, chỉ trả đất
 *   4. trackBehavior()           → Ghi hành vi user + xóa cache cũ
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ScoringService } from './services/scoring.service';
import { VectorService } from './services/vector.service';
import { UserProfileService } from './services/user-profile.service';
import {
  WeightedInteraction,
  HybridScoredProperty,
  VectorSearchResult,
} from './interfaces/recommendation.interfaces';
import {
  RECOMMENDATION_TTL,
  HOUSE_ID_OFFSET,
  LAND_ID_OFFSET,
  BEHAVIOR_WEIGHTS,
  SCORING_WEIGHTS,
  EMBEDDING_CONFIG,
  QUERY_LIMITS,
  cacheKeys,
} from './constants/recommendation.constants';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService, // Truy vấn MySQL
    private readonly redis: RedisService, // Cache kết quả gợi ý
    private readonly scoring: ScoringService, // Chấm điểm BĐS (rule-based)
    private readonly vector: VectorService, // AI embedding + Qdrant search
    private readonly userProfile: UserProfileService, // Phân tích sở thích user
  ) {}

  // ==================== HYBRID AI RECOMMENDATIONS ====================

  /**
   * LUỒNG CHÍNH: Gợi ý Hybrid AI — 14 bước.
   * Kết hợp Embedding (Qdrant) + Rule-based scoring.
   * Trả về cả nhà lẫn đất, xen kẽ, đa dạng.
   */
  async getAIRecommendations(
    userId: number,
    limit: number = QUERY_LIMITS.AI_DEFAULT_LIMIT,
  ) {
    const cacheKey = cacheKeys.aiRecommendation(userId);

    // ═══ BƯỚC 1: Kiểm tra cache Redis (TTL = 5 phút) ═══
    // Nếu cache HIT → trả ngay, không tính toán lại (~50ms)
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    // ═══ BƯỚC 2: Query 3 nguồn hành vi SONG SONG (Promise.all) ═══
    // 1) behaviors: lịch sử click/save (100 gần nhất)
    // 2) houseFavorites: danh sách nhà yêu thích
    // 3) landFavorites: danh sách đất yêu thích
    const [behaviors, houseFavorites, landFavorites] = await Promise.all([
      this.prisma.userBehavior.findMany({
        where: { userId, action: { in: ['click', 'save'] } },
        select: { houseId: true, landId: true, action: true },
        orderBy: { createdAt: 'desc' },
        take: QUERY_LIMITS.BEHAVIOR_LIMIT, // 100
      }),
      this.prisma.favorite.findMany({
        where: { userId, houseId: { not: null } },
        select: { houseId: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId, landId: { not: null } },
        select: { landId: true },
      }),
    ]);

    // ═══ BƯỚC 3: Gộp tương tác thành danh sách có trọng số ═══
    // Dùng Map để gộp: nếu user click nhà A (w=2) rồi save nhà A (w=3)
    // → tổng weight nhà A = 2 + 3 = 5 (quan tâm rất cao)
    const interactionMap = new Map<string, WeightedInteraction>();

    // Duyệt behaviors: gán trọng số theo action
    for (const b of behaviors) {
      const weight =
        b.action === 'save'
          ? BEHAVIOR_WEIGHTS.SAVE // save → w=3
          : b.action === 'click'
            ? BEHAVIOR_WEIGHTS.CLICK // click → w=2
            : BEHAVIOR_WEIGHTS.DEFAULT; // khác → w=1
      if (b.houseId) {
        const key = `house:${b.houseId}`;
        const existing = interactionMap.get(key);
        interactionMap.set(key, {
          id: b.houseId,
          type: 'house',
          qdrantId: HOUSE_ID_OFFSET + b.houseId,
          weight: (existing?.weight || 0) + weight,
        });
      }
      if (b.landId) {
        const key = `land:${b.landId}`;
        const existing = interactionMap.get(key);
        interactionMap.set(key, {
          id: b.landId,
          type: 'land',
          qdrantId: LAND_ID_OFFSET + b.landId,
          weight: (existing?.weight || 0) + weight,
        });
      }
    }

    for (const f of houseFavorites) {
      if (f.houseId) {
        const key = `house:${f.houseId}`;
        const existing = interactionMap.get(key);
        interactionMap.set(key, {
          id: f.houseId,
          type: 'house',
          qdrantId: HOUSE_ID_OFFSET + f.houseId,
          weight: (existing?.weight || 0) + BEHAVIOR_WEIGHTS.FAVORITE,
        });
      }
    }
    for (const f of landFavorites) {
      if (f.landId) {
        const key = `land:${f.landId}`;
        const existing = interactionMap.get(key);
        interactionMap.set(key, {
          id: f.landId,
          type: 'land',
          qdrantId: LAND_ID_OFFSET + f.landId,
          weight: (existing?.weight || 0) + BEHAVIOR_WEIGHTS.FAVORITE,
        });
      }
    }

    const interactions = Array.from(interactionMap.values());
    const interactedHouseIds = new Set(
      interactions.filter((i) => i.type === 'house').map((i) => i.id),
    );
    const interactedLandIds = new Set(
      interactions.filter((i) => i.type === 'land').map((i) => i.id),
    );

    // ═══ BƯỚC 4: COLD-START — User mới chưa có hành vi ═══
    // → Trả BĐS phổ biến (nhiều favorite) hoặc mới đăng nhất
    if (interactions.length === 0) {
      const fallback = await this.userProfile.getPopularMixed(limit);
      await this.redis
        .set(cacheKey, fallback, RECOMMENDATION_TTL)
        .catch((err) => {
          this.logger.warn(`Redis set failed for ${cacheKey}: ${err.message}`);
        });
      return fallback;
    }

    // ═══ BƯỚC 5: Tạo User Vector (trung bình có trọng số từ Qdrant) ═══
    const userVector = await this.vector.buildUserVector(userId, interactions);

    // ═══ BƯỚC 6: Vector Search — tìm BĐS có vector gần user nhất ═══
    let vectorCandidates: VectorSearchResult[] = [];
    if (userVector) {
      vectorCandidates = await this.vector.vectorSearch(
        userVector,
        QUERY_LIMITS.VECTOR_CANDIDATE_LIMIT, // top 100
        interactions, // loại trừ BĐS đã xem
      );
    }

    // ═══ BƯỚC 7: Xây dựng User Profile (cho rule-based scoring) ═══
    // Lấy thông tin BĐS đã tương tác → tính: giá TB, khu vực hay xem, loại BĐS
    const allInteractedProperties =
      await this.userProfile.fetchInteractedProperties(interactions);
    const profile = this.userProfile.buildUserProfile(
      allInteractedProperties.map((p) => ({
        ...p,
        weight: interactionMap.get(`${p.type}:${p.id}`)?.weight || 1,
      })),
    );
    // profile = { avgPrice: 4.2 tỷ, locationCounts: {"HCM|Q7": 5}, ... }

    // Đếm loại đất user hay xem (VD: {"Thổ cư": 5, "Nông nghiệp": 2})
    const landTypeCounts: Record<string, number> = {};
    for (const p of allInteractedProperties) {
      if (p.type === 'land' && p.landType) {
        const w = interactionMap.get(`land:${p.id}`)?.weight || 1;
        landTypeCounts[p.landType] = (landTypeCounts[p.landType] || 0) + w;
      }
    }

    // ═══ BƯỚC 8: Query BĐS ứng viên từ MySQL ═══
    // Lọc theo profile: giá ±50%, khu vực quen, loại BĐS quen
    // Loại trừ BĐS user đã xem (notIn)
    const candidateFilters = this.userProfile.buildCandidateFilters(profile);
    const [dbHouses, dbLands] = await Promise.all([
      this.prisma.house.findMany({
        where: {
          id: { notIn: Array.from(interactedHouseIds) },
          status: 1,
          OR: candidateFilters,
        },
        include: {
          images: { select: { id: true, url: true }, take: 1 },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: QUERY_LIMITS.DB_CANDIDATE_LIMIT,
      }),
      this.prisma.land.findMany({
        where: {
          id: { notIn: Array.from(interactedLandIds) },
          status: 1,
          OR: candidateFilters,
        },
        include: {
          images: { select: { id: true, url: true }, take: 1 },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: QUERY_LIMITS.DB_CANDIDATE_LIMIT,
      }),
    ]);

    // ═══ BƯỚC 9: Tạo bảng điểm embedding cho mỗi BĐS ═══
    // VD: embeddingScoreMap = { "house:99": 0.85, "land:42": 0.62 }
    const embeddingScoreMap = new Map<string, number>();
    for (const vc of vectorCandidates) {
      const source = String(vc.payload?.source || '');
      const sourceId = Number(vc.payload?.sourceId || 0);
      if (source && sourceId > 0) {
        const normalized = this.scoring.normalizeEmbeddingScore(vc.score);
        embeddingScoreMap.set(`${source}:${sourceId}`, normalized);
      }
    }

    // ═══ Quyết định trọng số AI vs Rules ═══
    // User nhiều tương tác (>10) → tin AI hơn (70% AI, 30% Rules)
    // User ít tương tác (≤10)  → tin Rules hơn (40% AI, 60% Rules)
    const weightEmbedding =
      profile.totalWeight > EMBEDDING_CONFIG.HIGH_INTERACTION_THRESHOLD
        ? EMBEDDING_CONFIG.HIGH_EMBEDDING_WEIGHT // 0.7
        : EMBEDDING_CONFIG.LOW_EMBEDDING_WEIGHT; // 0.4
    const weightRule = 1 - weightEmbedding;

    // ═══ BƯỚC 10: HYBRID SCORING — Kết hợp AI + Rules ═══
    // Công thức: finalScore = AI_weight × embeddingScore + Rule_weight × ruleScore
    // VD (user cũ): finalScore = 0.7 × 0.85 + 0.3 × 0.72 = 0.60 + 0.22 = 0.82
    // VD (user mới): finalScore = 0.4 × 0.85 + 0.6 × 0.72 = 0.34 + 0.43 = 0.77
    const hybridScored: HybridScoredProperty[] = [];

    // Chấm điểm từng NHÀ ứng viên
    for (const house of dbHouses) {
      if (interactedHouseIds.has(house.id)) continue; // Bỏ qua BĐS đã xem
      const { score: ruleScore, reasons } = this.scoring.calculateScore(
        house,
        profile,
      );
      const embeddingScore = embeddingScoreMap.get(`house:${house.id}`) || 0;
      const finalScore =
        weightEmbedding * embeddingScore + weightRule * ruleScore;

      const daysSinceCreated =
        (Date.now() - new Date(house.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      let boostedScore = finalScore;
      if (daysSinceCreated < SCORING_WEIGHTS.FRESHNESS_DAYS) {
        boostedScore += SCORING_WEIGHTS.FRESHNESS_BOOST;
        reasons.push('Mới đăng');
      }
      if (embeddingScore > EMBEDDING_CONFIG.AI_SUGGEST_THRESHOLD) {
        reasons.unshift('AI đề xuất phù hợp');
      }

      hybridScored.push({
        id: house.id,
        type: 'house',
        district: house.district || '',
        price: Number(house.price || 0),
        embeddingScore,
        ruleScore: Math.round(ruleScore * 100) / 100,
        finalScore: Math.round(Math.min(boostedScore, 1) * 100) / 100,
        reasons,
      });
    }

    for (const land of dbLands) {
      if (interactedLandIds.has(land.id)) continue;
      const { score: ruleScore, reasons } = this.scoring.calculateLandScore(
        land,
        profile,
        landTypeCounts,
      );
      const embeddingScore = embeddingScoreMap.get(`land:${land.id}`) || 0;
      const finalScore =
        weightEmbedding * embeddingScore + weightRule * ruleScore;

      const daysSinceCreated =
        (Date.now() - new Date(land.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      let boostedScore = finalScore;
      if (daysSinceCreated < SCORING_WEIGHTS.FRESHNESS_DAYS) {
        boostedScore += SCORING_WEIGHTS.FRESHNESS_BOOST;
        reasons.push('Mới đăng');
      }
      if (embeddingScore > EMBEDDING_CONFIG.AI_SUGGEST_THRESHOLD) {
        reasons.unshift('AI đề xuất phù hợp');
      }

      hybridScored.push({
        id: land.id,
        type: 'land',
        district: land.district || '',
        price: Number(land.price || 0),
        embeddingScore,
        ruleScore: Math.round(ruleScore * 100) / 100,
        finalScore: Math.round(Math.min(boostedScore, 1) * 100) / 100,
        reasons,
      });
    }

    // Bổ sung: BĐS chỉ có trong Qdrant nhưng không nằm trong DB query
    // (Qdrant có thể tìm thấy BĐS mà bộ lọc DB bỏ sót)
    for (const vc of vectorCandidates) {
      const source = String(vc.payload?.source || '') as 'house' | 'land';
      const sourceId = Number(vc.payload?.sourceId || 0);
      if (!source || sourceId <= 0) continue;
      if (source === 'house' && interactedHouseIds.has(sourceId)) continue;
      if (source === 'land' && interactedLandIds.has(sourceId)) continue;
      if (hybridScored.some((h) => h.id === sourceId && h.type === source))
        continue;

      const rawEmbedding = this.scoring.normalizeEmbeddingScore(vc.score);
      const reasons: string[] = ['AI đề xuất phù hợp'];
      hybridScored.push({
        id: sourceId,
        type: source,
        district: String(vc.payload?.district || ''),
        price: Number(vc.payload?.price || 0),
        embeddingScore: rawEmbedding,
        ruleScore: 0,
        finalScore: Math.round(rawEmbedding * weightEmbedding * 100) / 100,
        reasons,
      });
    }

    // ═══ BƯỚC 11: Sắp xếp theo điểm giảm dần ═══
    hybridScored.sort((a, b) => b.finalScore - a.finalScore);

    // ═══ BƯỚC 12: Đa dạng hóa — max 3 BĐS cùng (quận+giá+loại) ═══
    const diversified = this.scoring.applyDiversity(hybridScored, limit);

    // ═══ BƯỚC 13: Lấy dữ liệu đầy đủ (ảnh, category, nhân viên) ═══
    const topHouseIds = diversified
      .filter((d) => d.type === 'house')
      .map((d) => d.id);
    const topLandIds = diversified
      .filter((d) => d.type === 'land')
      .map((d) => d.id);

    const [fullHouses, fullLands] = await Promise.all([
      topHouseIds.length > 0
        ? this.prisma.house.findMany({
            where: { id: { in: topHouseIds } },
            include: {
              images: { select: { id: true, url: true } },
              category: true,
              employee: {
                include: {
                  user: { select: { id: true, fullName: true, phone: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      topLandIds.length > 0
        ? this.prisma.land.findMany({
            where: { id: { in: topLandIds } },
            include: {
              images: { select: { id: true, url: true } },
              category: true,
              employee: {
                include: {
                  user: { select: { id: true, fullName: true, phone: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const houseMap = new Map(fullHouses.map((h) => [h.id, h] as const));
    const landMap = new Map(fullLands.map((l) => [l.id, l] as const));

    // ═══ BƯỚC 14: Ghép điểm + lý do vào dữ liệu BĐS → trả về frontend ═══
    const result = diversified
      .map((item) => {
        const property =
          item.type === 'house' ? houseMap.get(item.id) : landMap.get(item.id);
        if (!property) return null;

        return {
          ...property,
          propertyType: item.type,
          recommendationScore: item.finalScore,
          recommendationReason: item.reasons.join(', '),
          embeddingScore: item.embeddingScore,
          ruleScore: item.ruleScore,
        };
      })
      .filter(Boolean);

    await this.redis.set(cacheKey, result, RECOMMENDATION_TTL).catch((err) => {
      this.logger.warn(`Redis set failed for ${cacheKey}: ${err.message}`);
    });
    this.logger.debug(
      `Generated ${result.length} AI hybrid recommendations for user ${userId}`,
    );

    return result;
  }

  // ==================== GỢI Ý NHÀ/ĐẤT RIÊNG (Rule-based, không dùng AI) ====================

  /**
   * Method dùng chung cho cả nhà và đất — chỉ dùng Rule-based scoring.
   * Luồng đơn giản hơn AI: Hành vi → Profile → Lọc DB → Chấm điểm → Trả kết quả.
   */
  private async getPropertyRecommendations(
    type: 'house' | 'land',
    userId: number,
    limit: number,
  ) {
    const cacheKey =
      type === 'house'
        ? cacheKeys.houseRecommendation(userId)
        : cacheKeys.landRecommendation(userId);

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Get user behavior data
    const idField = type === 'house' ? 'houseId' : 'landId';
    const includeField = type === 'house' ? 'house' : 'land';

    const selectFields =
      type === 'house'
        ? {
            id: true,
            price: true,
            city: true,
            district: true,
            ward: true,
            area: true,
            direction: true,
            categoryId: true,
            bedrooms: true,
            bathrooms: true,
          }
        : {
            id: true,
            price: true,
            city: true,
            district: true,
            ward: true,
            area: true,
            direction: true,
            categoryId: true,
            frontWidth: true,
            landLength: true,
            landType: true,
          };

    const behaviors = await this.prisma.userBehavior.findMany({
      where: {
        userId,
        [idField]: { not: null },
        action: { in: ['click', 'save'] },
      },
      include: {
        [includeField]: { select: selectFields },
      },
      orderBy: { createdAt: 'desc' },
      take: QUERY_LIMITS.LEGACY_BEHAVIOR_LIMIT,
    });

    const favorites = await this.prisma.favorite.findMany({
      where: { userId, [idField]: { not: null } },
      include: {
        [includeField]: { select: selectFields },
      },
    });

    // Build user profile from behavior
    const interactedItems = [
      ...behaviors
        .filter((b: any) => b[includeField])
        .map((b: any) => ({
          ...b[includeField]!,
          weight:
            b.action === 'save'
              ? BEHAVIOR_WEIGHTS.SAVE
              : b.action === 'click'
                ? BEHAVIOR_WEIGHTS.CLICK
                : BEHAVIOR_WEIGHTS.DEFAULT,
        })),
      ...favorites
        .filter((f: any) => f[includeField])
        .map((f: any) => ({
          ...f[includeField]!,
          weight: BEHAVIOR_WEIGHTS.FAVORITE,
        })),
    ];

    const interactedIds = new Set(interactedItems.map((h: any) => h.id));

    // If no behavior data, return popular/recent
    if (interactedItems.length === 0) {
      const popular =
        type === 'house'
          ? await this.userProfile.getPopularHouses(limit)
          : await this.userProfile.getPopularLands(limit);
      await this.redis
        .set(cacheKey, popular, RECOMMENDATION_TTL)
        .catch((err) => {
          this.logger.warn(`Redis set failed for ${cacheKey}: ${err.message}`);
        });
      return popular;
    }

    // 2. Build user preference profile
    const profile = this.userProfile.buildUserProfile(interactedItems);

    // Build land-specific profile if needed
    const landTypeCounts: Record<string, number> = {};
    if (type === 'land') {
      interactedItems.forEach((item: any) => {
        if (item.landType) {
          landTypeCounts[item.landType] =
            (landTypeCounts[item.landType] || 0) + item.weight;
        }
      });
    }

    // 3. Get candidate properties
    const candidateFilters = this.userProfile.buildCandidateFilters(profile);
    const model = type === 'house' ? this.prisma.house : this.prisma.land;
    const candidates = await (model as any).findMany({
      where: {
        id: { notIn: Array.from(interactedIds) },
        status: 1,
        OR: candidateFilters,
      },
      include: {
        images: { select: { id: true, url: true }, take: 1 },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: QUERY_LIMITS.CANDIDATE_LIMIT,
    });

    // 4. Score each candidate
    const scored = candidates.map((candidate: any) => {
      const { score, reasons } =
        type === 'land'
          ? this.scoring.calculateLandScore(candidate, profile, landTypeCounts)
          : this.scoring.calculateScore(candidate, profile);
      return {
        id: candidate.id,
        score: Math.round(score * 100) / 100,
        reason: reasons.join(', '),
      };
    });

    // 5. Sort by score descending, take top N
    scored.sort((a: any, b: any) => b.score - a.score);
    const topIds = scored.slice(0, limit);

    // 6. Fetch full data for top results
    const topProperties = await (model as any).findMany({
      where: { id: { in: topIds.map((t: any) => t.id) } },
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

    const result = topIds
      .map((item: any) => {
        const property = topProperties.find((p: any) => p.id === item.id);
        return {
          ...property,
          recommendationScore: item.score,
          recommendationReason: item.reason,
        };
      })
      .filter(Boolean);

    await this.redis.set(cacheKey, result, RECOMMENDATION_TTL).catch((err) => {
      this.logger.warn(`Redis set failed for ${cacheKey}: ${err.message}`);
    });
    this.logger.debug(
      `Generated ${result.length} ${type} recommendations for user ${userId}`,
    );

    return result;
  }

  // ==================== PUBLIC METHODS (preserve API contract) ====================

  async getHouseRecommendations(
    userId: number,
    limit: number = QUERY_LIMITS.LEGACY_DEFAULT_LIMIT,
  ) {
    return this.getPropertyRecommendations('house', userId, limit);
  }

  async getLandRecommendations(
    userId: number,
    limit: number = QUERY_LIMITS.LEGACY_DEFAULT_LIMIT,
  ) {
    return this.getPropertyRecommendations('land', userId, limit);
  }

  // ==================== GHI HÀNH VI USER ====================

  /**
   * Ghi lại hành vi user (click/save) vào DB.
   * Sau khi ghi → xóa cache gợi ý cũ → lần request tiếp sẽ tính lại.
   *
   * Eventual consistency: có thể có 1 khoảng ngắn cache cũ còn tồn tại
   * nhưng lần request sau sẽ luôn có data mới.
   */
  async trackBehavior(
    userId: number,
    action: string,
    houseId?: number,
    landId?: number,
  ) {
    if (!userId) {
      throw new UnauthorizedException(
        'Không xác định được người dùng đăng nhập',
      );
    }

    await this.prisma.userBehavior.create({
      data: { userId, houseId, landId, action },
    });

    // Xóa tất cả cache gợi ý của user này để lần sau tính lại
    const keysToDelete = [
      cacheKeys.aiRecommendation(userId),
      cacheKeys.userVector(userId),
      ...(houseId ? [cacheKeys.houseRecommendation(userId)] : []),
      ...(landId ? [cacheKeys.landRecommendation(userId)] : []),
    ];

    await Promise.all(
      keysToDelete.map((key) =>
        this.redis.del(key).catch((err) => {
          this.logger.warn(`Redis del failed for ${key}: ${err.message}`);
        }),
      ),
    );

    return { message: 'Behavior tracked' };
  }
}
