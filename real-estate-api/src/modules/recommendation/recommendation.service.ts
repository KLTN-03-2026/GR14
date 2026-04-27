import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const RECOMMENDATION_TTL = 300; // 5 minutes
const EMBEDDING_CACHE_TTL = 3600; // 1 hour
const houseRecommendationKey = (userId: number) =>
  `recommendations:houses:${userId}`;
const landRecommendationKey = (userId: number) =>
  `recommendations:lands:${userId}`;
const aiRecommendationKey = (userId: number) => `recommendations:ai:${userId}`;
const userVectorKey = (userId: number) => `recommendations:uservec:${userId}`;

// Qdrant ID offsets (must match ai.service.ts indexData)
const HOUSE_ID_OFFSET = 1_000_000;
const LAND_ID_OFFSET = 2_000_000;

interface ScoredProperty {
  id: number;
  score: number;
  reason: string;
}

interface HybridScoredProperty {
  id: number;
  type: 'house' | 'land';
  district: string;
  price: number;
  embeddingScore: number;
  ruleScore: number;
  finalScore: number;
  reasons: string[];
}

interface UserProfile {
  avgPrice: number;
  avgArea: number;
  locationCounts: Record<string, number>;
  categoryCounts: Record<number, number>;
  totalWeight: number;
}

interface VectorSearchResult {
  id: number;
  score: number;
  payload: Record<string, unknown>;
}

interface WeightedInteraction {
  id: number;
  type: 'house' | 'land';
  qdrantId: number;
  weight: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  private readonly qdrantUrl =
    process.env.QDRANT_URL || 'http://real-estate-qdrant:6333';
  private readonly ollamaUrl =
    process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
  private readonly ragCollection =
    process.env.RAG_COLLECTION || 'real_estate_rag';
  private readonly embedModel = process.env.EMBED_MODEL || 'nomic-embed-text';
  private readonly qdrantTimeoutMs = Number(
    process.env.QDRANT_TIMEOUT_MS || 2500,
  );
  private readonly embedTimeoutMs = Number(
    process.env.EMBED_TIMEOUT_MS || 5000,
  );

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ==================== HYBRID AI RECOMMENDATIONS ====================

  async getAIRecommendations(userId: number, limit = 10) {
    const cacheKey = aiRecommendationKey(userId);

    // 1. Check cache
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 2. Fetch user behaviors + favorites
    const [behaviors, houseFavorites, landFavorites] = await Promise.all([
      this.prisma.userBehavior.findMany({
        where: { userId, action: { in: ['click', 'save'] } },
        select: { houseId: true, landId: true, action: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
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

    // 3. Build weighted interactions list
    const interactionMap = new Map<string, WeightedInteraction>();

    for (const b of behaviors) {
      const weight = b.action === 'save' ? 3 : b.action === 'click' ? 2 : 1;
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
          weight: (existing?.weight || 0) + 3,
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
          weight: (existing?.weight || 0) + 3,
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

    // 4. Fallback: no behavior → popular/recent mix
    if (interactions.length === 0) {
      const fallback = await this.getPopularMixed(limit);
      await this.redis
        .set(cacheKey, fallback, RECOMMENDATION_TTL)
        .catch(() => {});
      return fallback;
    }

    // 5. Build user embedding vector (weighted average of interacted property embeddings)
    const userVector = await this.buildUserVector(userId, interactions);

    let vectorCandidates: VectorSearchResult[] = [];
    if (userVector) {
      vectorCandidates = await this.vectorSearch(userVector, 100, interactions);
    }

    // 7. Build user profile for rule-based scoring
    const allInteractedProperties =
      await this.fetchInteractedProperties(interactions);
    const profile = this.buildUserProfile(
      allInteractedProperties.map((p) => ({
        ...p,
        weight: interactionMap.get(`${p.type}:${p.id}`)?.weight || 1,
      })),
    );

    // 8. Build land-type counts for land scoring
    const landTypeCounts: Record<string, number> = {};
    for (const p of allInteractedProperties) {
      if (p.type === 'land' && p.landType) {
        const w = interactionMap.get(`land:${p.id}`)?.weight || 1;
        landTypeCounts[p.landType] = (landTypeCounts[p.landType] || 0) + w;
      }
    }

    // 9. Also fetch DB candidates (for properties not yet in Qdrant or vector search misses)
    const [dbHouses, dbLands] = await Promise.all([
      this.prisma.house.findMany({
        where: {
          id: { notIn: Array.from(interactedHouseIds) },
          status: 1,
          OR: this.buildCandidateFilters(profile),
        },
        include: {
          images: { select: { id: true, url: true }, take: 1 },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.land.findMany({
        where: {
          id: { notIn: Array.from(interactedLandIds) },
          status: 1,
          OR: this.buildCandidateFilters(profile),
        },
        include: {
          images: { select: { id: true, url: true }, take: 1 },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const embeddingScoreMap = new Map<string, number>();
    for (const vc of vectorCandidates) {
      const source = String(vc.payload?.source || '');
      const sourceId = Number(vc.payload?.sourceId || 0);
      if (source && sourceId > 0) {
        const normalized = this.normalizeEmbeddingScore(vc.score);
        embeddingScoreMap.set(`${source}:${sourceId}`, normalized);
      }
    }

    const weightEmbedding = profile.totalWeight > 10 ? 0.7 : 0.4;
    const weightRule = 1 - weightEmbedding;

    // 11. Hybrid scoring: combine embedding + rule-based scores
    const hybridScored: HybridScoredProperty[] = [];

    for (const house of dbHouses) {
      if (interactedHouseIds.has(house.id)) continue;
      const { score: ruleScore, reasons } = this.calculateScore(house, profile);
      const embeddingScore = embeddingScoreMap.get(`house:${house.id}`) || 0;
      const finalScore =
        weightEmbedding * embeddingScore + weightRule * ruleScore;

      // Freshness boost
      const daysSinceCreated =
        (Date.now() - new Date(house.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      let boostedScore = finalScore;
      if (daysSinceCreated < 7) {
        boostedScore += 0.03;
        reasons.push('Mới đăng');
      }
      if (embeddingScore > 0.5) {
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
      const { score: ruleScore, reasons } = this.calculateLandScore(
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
      if (daysSinceCreated < 7) {
        boostedScore += 0.03;
        reasons.push('Mới đăng');
      }
      if (embeddingScore > 0.5) {
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

    // Also include vector-only candidates (found by Qdrant but not in DB query results)
    for (const vc of vectorCandidates) {
      const source = String(vc.payload?.source || '') as 'house' | 'land';
      const sourceId = Number(vc.payload?.sourceId || 0);
      if (!source || sourceId <= 0) continue;
      if (source === 'house' && interactedHouseIds.has(sourceId)) continue;
      if (source === 'land' && interactedLandIds.has(sourceId)) continue;
      if (hybridScored.some((h) => h.id === sourceId && h.type === source))
        continue;

      const rawEmbedding = this.normalizeEmbeddingScore(vc.score);
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

    // 12. Sort by finalScore DESC
    hybridScored.sort((a, b) => b.finalScore - a.finalScore);

    // 13. Apply diversity: max 3 from same district
    const diversified = this.applyDiversity(hybridScored, limit);

    // 14. Fetch full property data for top results
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

    // 15. Build final output
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

    await this.redis.set(cacheKey, result, RECOMMENDATION_TTL).catch(() => {});
    this.logger.debug(
      `Generated ${result.length} AI hybrid recommendations for user ${userId}`,
    );

    return result;
  }

  // ==================== USER VECTOR BUILDING ====================

  private async buildUserVector(
    userId: number,
    interactions: WeightedInteraction[],
  ): Promise<number[] | null> {
    // Check cached user vector
    const vecCacheKey = userVectorKey(userId);
    const cachedVector = await this.redis
      .get<number[]>(vecCacheKey)
      .catch(() => null);
    if (Array.isArray(cachedVector) && cachedVector.length > 0) {
      this.logger.debug(`User vector cache HIT for user ${userId}`);
      return cachedVector;
    }

    // Fetch embeddings from Qdrant by point IDs
    const qdrantIds = interactions.map((i) => i.qdrantId);
    let pointVectors: Array<{ id: number; vector: number[] }> = [];

    try {
      const resp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points`,
        { ids: qdrantIds, with_vector: true },
        { timeout: this.qdrantTimeoutMs },
      );

      const points = resp.data?.result || [];
      pointVectors = points
        .filter((p: any) => Array.isArray(p.vector) && p.vector.length > 0)
        .map((p: any) => ({ id: Number(p.id), vector: p.vector as number[] }));
    } catch (error) {
      this.logger.warn(
        `Failed to fetch point vectors from Qdrant: ${this.stringifyError(error)}`,
      );
    }

    // If no vectors found in Qdrant, try generating embedding from user's interaction text
    if (pointVectors.length === 0) {
      const fallbackVector = await this.buildUserVectorFromText(interactions);
      if (fallbackVector) {
        await this.redis
          .set(vecCacheKey, fallbackVector, EMBEDDING_CACHE_TTL)
          .catch(() => {});
      }
      return fallbackVector;
    }

    // Compute weighted average vector
    const weightMap = new Map(interactions.map((i) => [i.qdrantId, i.weight]));
    const vectorDim = pointVectors[0].vector.length;
    const avgVector = new Array<number>(vectorDim).fill(0);
    let totalWeight = 0;

    for (const pv of pointVectors) {
      const w = weightMap.get(pv.id) || 1;
      totalWeight += w;
      for (let i = 0; i < vectorDim; i++) {
        avgVector[i] += pv.vector[i] * w;
      }
    }

    if (totalWeight > 0) {
      for (let i = 0; i < vectorDim; i++) {
        avgVector[i] /= totalWeight;
      }
    }

    await this.redis
      .set(vecCacheKey, avgVector, EMBEDDING_CACHE_TTL)
      .catch(() => {});
    this.logger.debug(
      `Built user vector from ${pointVectors.length} embeddings (${interactions.length} interactions)`,
    );

    return avgVector;
  }

  private async buildUserVectorFromText(
    interactions: WeightedInteraction[],
  ): Promise<number[] | null> {
    // Fallback: build a text summary from user interactions and embed it
    const topInteractions = interactions
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    const houseIds = topInteractions
      .filter((i) => i.type === 'house')
      .map((i) => i.id);
    const landIds = topInteractions
      .filter((i) => i.type === 'land')
      .map((i) => i.id);

    const [houses, lands] = await Promise.all([
      houseIds.length > 0
        ? this.prisma.house.findMany({
            where: { id: { in: houseIds } },
            select: {
              title: true,
              city: true,
              district: true,
              price: true,
              area: true,
            },
          })
        : Promise.resolve([]),
      landIds.length > 0
        ? this.prisma.land.findMany({
            where: { id: { in: landIds } },
            select: {
              title: true,
              city: true,
              district: true,
              price: true,
              area: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const parts = [
      ...houses.map(
        (h) =>
          `Nha: ${h.title}, ${h.district} ${h.city}, gia ${h.price}, dt ${h.area}`,
      ),
      ...lands.map(
        (l) =>
          `Dat: ${l.title}, ${l.district} ${l.city}, gia ${l.price}, dt ${l.area}`,
      ),
    ];

    if (parts.length === 0) return null;

    const text = `Nguoi dung quan tam: ${parts.join('. ')}`;

    try {
      const resp = await axios.post(
        `${this.ollamaUrl}/api/embed`,
        { model: this.embedModel, input: text },
        { timeout: this.embedTimeoutMs },
      );
      const vector = resp.data?.embeddings?.[0] || resp.data?.embedding;
      if (Array.isArray(vector) && vector.length > 0) return vector;
    } catch (error) {
      this.logger.warn(
        `Fallback embedding failed: ${this.stringifyError(error)}`,
      );
    }

    return null;
  }

  // ==================== VECTOR SEARCH ====================

  private async vectorSearch(
    userVector: number[],
    candidateLimit: number,
    excludeInteractions: WeightedInteraction[],
  ): Promise<VectorSearchResult[]> {
    try {
      const excludeIds = excludeInteractions.map((i) => i.qdrantId);

      const resp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points/search`,
        {
          vector: userVector,
          limit: candidateLimit,
          with_payload: true,
          filter:
            excludeIds.length > 0
              ? { must_not: [{ has_id: excludeIds }] }
              : undefined,
        },
        { timeout: this.qdrantTimeoutMs },
      );

      const results = (resp.data?.result || []) as Array<{
        id: number;
        score: number;
        payload: Record<string, unknown>;
      }>;

      // Only keep house/land results with reasonable scores
      return results
        .filter((r) => {
          const source = String(r.payload?.source || '');
          return (source === 'house' || source === 'land') && r.score > 0.1;
        })
        .map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
    } catch (error) {
      this.logger.warn(`Vector search failed: ${this.stringifyError(error)}`);
      return [];
    }
  }

  // ==================== HYBRID SCORING ====================

  private normalizeEmbeddingScore(raw: number): number {
    return Math.max(0, (raw - 0.2) / (1 - 0.2));
  }

  // ==================== DIVERSITY ====================

  private applyDiversity(
    scored: HybridScoredProperty[],
    limit: number,
  ): HybridScoredProperty[] {
    const result: HybridScoredProperty[] = [];
    const bucketCount = new Map<string, number>();
    const maxPerBucket = 2;
    const deferred: HybridScoredProperty[] = [];

    for (const item of scored) {
      if (result.length >= limit) break;

      const bucket = this.diversityBucket(item);
      const count = bucketCount.get(bucket) || 0;
      if (count >= maxPerBucket) {
        deferred.push(item);
        continue;
      }
      bucketCount.set(bucket, count + 1);
      result.push(item);
    }

    // Fill remaining slots with deferred items
    for (const item of deferred) {
      if (result.length >= limit) break;
      result.push(item);
    }

    return result;
  }

  private diversityBucket(item: HybridScoredProperty): string {
    const district = item.district || 'unknown';
    const priceBucket = this.priceBucket(item.price);
    return `${district}|${priceBucket}|${item.type}`;
  }

  private priceBucket(price: number): string {
    if (price <= 0) return 'na';
    if (price < 1_000_000_000) return 'under1ty';
    if (price < 3_000_000_000) return '1-3ty';
    if (price < 5_000_000_000) return '3-5ty';
    if (price < 10_000_000_000) return '5-10ty';
    return 'over10ty';
  }

  // ==================== FETCH INTERACTED PROPERTIES ====================

  private async fetchInteractedProperties(
    interactions: WeightedInteraction[],
  ): Promise<
    Array<{
      id: number;
      type: 'house' | 'land';
      price: any;
      city: string | null;
      district: string | null;
      area: number | null;
      categoryId: number | null;
      landType?: string | null;
    }>
  > {
    const houseIds = interactions
      .filter((i) => i.type === 'house')
      .map((i) => i.id);
    const landIds = interactions
      .filter((i) => i.type === 'land')
      .map((i) => i.id);

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

    return [
      ...houses.map((h) => ({ ...h, type: 'house' as const })),
      ...lands.map((l) => ({ ...l, type: 'land' as const })),
    ];
  }

  // ==================== POPULAR MIXED FALLBACK ====================

  private async getPopularMixed(limit: number) {
    const houseLimit = Math.ceil(limit / 2);
    const landLimit = limit - houseLimit;

    const [houses, lands] = await Promise.all([
      this.getPopularHouses(houseLimit),
      this.getPopularLands(landLimit),
    ]);

    const mixed = [
      ...houses.map((h: any) => ({ ...h, propertyType: 'house' })),
      ...lands.map((l: any) => ({ ...l, propertyType: 'land' })),
    ];

    // Interleave houses and lands
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

  // ==================== TRACK BEHAVIOR ====================

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

    // Invalidate all recommendation caches for this user
    await Promise.all([
      houseId
        ? this.redis.del(houseRecommendationKey(userId)).catch(() => {})
        : Promise.resolve(),
      landId
        ? this.redis.del(landRecommendationKey(userId)).catch(() => {})
        : Promise.resolve(),
      this.redis.del(aiRecommendationKey(userId)).catch(() => {}),
      this.redis.del(userVectorKey(userId)).catch(() => {}),
    ]);

    return { message: 'Behavior tracked' };
  }

  // ==================== HOUSE RECOMMENDATIONS (existing) ====================

  async getHouseRecommendations(userId: number, limit = 5) {
    const cacheKey = houseRecommendationKey(userId);

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Get user behavior data
    const behaviors = await this.prisma.userBehavior.findMany({
      where: {
        userId,
        houseId: { not: null },
        action: { in: ['click', 'save'] },
      },
      include: {
        house: {
          select: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Get user favorites
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, houseId: { not: null } },
      include: {
        house: {
          select: {
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
          },
        },
      },
    });

    // Build user profile from behavior
    const interactedItems = [
      ...behaviors
        .filter((b) => b.house)
        .map((b) => ({
          ...b.house!,
          weight: b.action === 'save' ? 3 : b.action === 'click' ? 2 : 1,
        })),
      ...favorites
        .filter((f) => f.house)
        .map((f) => ({
          ...f.house!,
          weight: 3,
        })),
    ];

    const interactedIds = new Set(interactedItems.map((h) => h.id));

    // If no behavior data, return popular/recent
    if (interactedItems.length === 0) {
      const popular = await this.getPopularHouses(limit);
      await this.redis
        .set(cacheKey, popular, RECOMMENDATION_TTL)
        .catch(() => {});
      return popular;
    }

    // 3. Build user preference profile
    const profile = this.buildUserProfile(interactedItems);

    // 4. Get candidate houses (pre-filtered by user preferences)
    const candidates = await this.prisma.house.findMany({
      where: {
        id: { notIn: Array.from(interactedIds) },
        status: 1,
        OR: this.buildCandidateFilters(profile),
      },
      include: {
        images: { select: { id: true, url: true }, take: 1 },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 5. Score each candidate
    const scored: ScoredProperty[] = candidates.map((house) => {
      const { score, reasons } = this.calculateScore(house, profile);
      return {
        id: house.id,
        score: Math.round(score * 100) / 100,
        reason: reasons.join(', '),
      };
    });

    // 6. Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const topIds = scored.slice(0, limit);

    // 7. Fetch full data for top results
    const topHouses = await this.prisma.house.findMany({
      where: { id: { in: topIds.map((t) => t.id) } },
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
      .map((item) => {
        const house = topHouses.find((h) => h.id === item.id);
        return {
          ...house,
          recommendationScore: item.score,
          recommendationReason: item.reason,
        };
      })
      .filter(Boolean);

    await this.redis.set(cacheKey, result, RECOMMENDATION_TTL).catch(() => {});
    this.logger.debug(
      `Generated ${result.length} house recommendations for user ${userId}`,
    );

    return result;
  }

  // ==================== LAND RECOMMENDATIONS (existing) ====================

  async getLandRecommendations(userId: number, limit = 5) {
    const cacheKey = landRecommendationKey(userId);

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    // 1. Get user behavior data for lands
    const behaviors = await this.prisma.userBehavior.findMany({
      where: {
        userId,
        landId: { not: null },
        action: { in: ['click', 'save'] },
      },
      include: {
        land: {
          select: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Get user favorites for lands
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, landId: { not: null } },
      include: {
        land: {
          select: {
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
          },
        },
      },
    });

    // Build user profile from behavior
    const interactedItems = [
      ...behaviors
        .filter((b) => b.land)
        .map((b) => ({
          ...b.land!,
          weight: b.action === 'save' ? 3 : b.action === 'click' ? 2 : 1,
        })),
      ...favorites
        .filter((f) => f.land)
        .map((f) => ({
          ...f.land!,
          weight: 3,
        })),
    ];

    const interactedIds = new Set(interactedItems.map((l) => l.id));

    // If no behavior data, return popular/recent
    if (interactedItems.length === 0) {
      const popular = await this.getPopularLands(limit);
      await this.redis
        .set(cacheKey, popular, RECOMMENDATION_TTL)
        .catch(() => {});
      return popular;
    }

    // 3. Build user preference profile
    const profile = this.buildUserProfile(interactedItems);

    // Build land-specific profile (landType preferences)
    const landTypeCounts: Record<string, number> = {};
    interactedItems.forEach((item) => {
      const land = item as any;
      if (land.landType) {
        landTypeCounts[land.landType] =
          (landTypeCounts[land.landType] || 0) + item.weight;
      }
    });

    // 4. Get candidate lands (pre-filtered by user preferences)
    const candidates = await this.prisma.land.findMany({
      where: {
        id: { notIn: Array.from(interactedIds) },
        status: 1,
        OR: this.buildCandidateFilters(profile),
      },
      include: {
        images: { select: { id: true, url: true }, take: 1 },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 5. Score each candidate
    const scored: ScoredProperty[] = candidates.map((land) => {
      const { score, reasons } = this.calculateLandScore(
        land,
        profile,
        landTypeCounts,
      );
      return {
        id: land.id,
        score: Math.round(score * 100) / 100,
        reason: reasons.join(', '),
      };
    });

    // 6. Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const topIds = scored.slice(0, limit);

    // 7. Fetch full data for top results
    const topLands = await this.prisma.land.findMany({
      where: { id: { in: topIds.map((t) => t.id) } },
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
      .map((item) => {
        const land = topLands.find((l) => l.id === item.id);
        return {
          ...land,
          recommendationScore: item.score,
          recommendationReason: item.reason,
        };
      })
      .filter(Boolean);

    await this.redis.set(cacheKey, result, RECOMMENDATION_TTL).catch(() => {});
    this.logger.debug(
      `Generated ${result.length} land recommendations for user ${userId}`,
    );

    return result;
  }

  // ==================== SHARED HELPERS ====================

  private buildCandidateFilters(profile: UserProfile): any[] {
    const filters: any[] = [];

    // Price range: ±50% of user's average price
    if (profile.avgPrice > 0) {
      filters.push({
        price: {
          gte: Math.round(profile.avgPrice * 0.5),
          lte: Math.round(profile.avgPrice * 1.5),
        },
      });
    }

    // Preferred locations (top locations by weight)
    const topLocations = Object.entries(profile.locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [key] of topLocations) {
      const [city, district] = key.split('|');
      filters.push({ city, district });
    }

    // Preferred categories
    const topCategories = Object.entries(profile.categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => Number(id));
    if (topCategories.length > 0) {
      filters.push({ categoryId: { in: topCategories } });
    }

    // Area range: ±50% of user's average area
    if (profile.avgArea > 0) {
      filters.push({
        area: {
          gte: Math.round(profile.avgArea * 0.5),
          lte: Math.round(profile.avgArea * 1.5),
        },
      });
    }

    // Fallback: if no filters could be built, don't restrict
    return filters.length > 0 ? filters : [{}];
  }

  private buildUserProfile(
    items: Array<any & { weight: number }>,
  ): UserProfile {
    const totalWeight = items.reduce((sum, h) => sum + h.weight, 0);

    // Weighted average price
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

    // Most frequent city/district (weighted)
    const locationCounts: Record<string, number> = {};
    items.forEach((h) => {
      if (h.city && h.district) {
        const key = `${h.city}|${h.district}`;
        locationCounts[key] = (locationCounts[key] || 0) + h.weight;
      }
    });

    // Most frequent categories
    const categoryCounts: Record<number, number> = {};
    items.forEach((h) => {
      if (h.categoryId) {
        categoryCounts[h.categoryId] =
          (categoryCounts[h.categoryId] || 0) + h.weight;
      }
    });

    // Average area
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

  private calculateScore(
    property: any,
    profile: UserProfile,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // --- Price match (30%) ---
    if (profile.avgPrice > 0 && property.price) {
      const propPrice = Number(property.price);
      const priceDiff =
        Math.abs(propPrice - profile.avgPrice) / profile.avgPrice;
      const priceScore = Math.max(0, 1 - priceDiff);
      score += priceScore * 0.3;
      if (priceScore > 0.6) reasons.push('Mức giá phù hợp');
    }

    // --- Location match (30%) ---
    if (property.city && property.district) {
      const locationKey = `${property.city}|${property.district}`;
      const maxLocationWeight = Math.max(
        ...Object.values(profile.locationCounts),
        1,
      );
      const locationWeight = profile.locationCounts[locationKey] || 0;
      const locationScore = locationWeight / maxLocationWeight;
      score += locationScore * 0.3;
      if (locationScore > 0.5) reasons.push('Khu vực bạn quan tâm');
    }

    // --- Similarity to viewed/clicked (30%) ---
    let similarityScore = 0;
    let similarityCount = 0;

    // Category match
    if (property.categoryId && profile.categoryCounts[property.categoryId]) {
      const maxCatWeight = Math.max(
        ...Object.values(profile.categoryCounts),
        1,
      );
      similarityScore +=
        (profile.categoryCounts[property.categoryId] / maxCatWeight) * 0.4;
      similarityCount++;
    }

    // Area similarity
    if (profile.avgArea > 0 && property.area) {
      const areaDiff =
        Math.abs(Number(property.area) - profile.avgArea) / profile.avgArea;
      similarityScore += Math.max(0, 1 - areaDiff) * 0.3;
      similarityCount++;
    }

    if (similarityCount > 0) {
      score += (similarityScore / similarityCount) * similarityCount * 0.3;
      if (similarityScore > 0.3) reasons.push('Giống các BĐS bạn đã xem');
    }

    // --- Diversity bonus (10%) ---
    if (property.city && property.district) {
      const locationKey = `${property.city}|${property.district}`;
      if (!profile.locationCounts[locationKey]) {
        score += 0.05;
        reasons.push('Khám phá khu vực mới');
      }
    }
    const daysSinceCreated =
      (Date.now() - new Date(property.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) {
      score += 0.05;
      reasons.push('Mới đăng');
    }

    if (reasons.length === 0) reasons.push('Có thể phù hợp với bạn');

    return { score: Math.min(score, 1), reasons };
  }

  private calculateLandScore(
    land: any,
    profile: UserProfile,
    landTypeCounts: Record<string, number>,
  ): { score: number; reasons: string[] } {
    // Base scoring same as house
    const { score: baseScore, reasons } = this.calculateScore(land, profile);
    let score = baseScore;

    // Bonus: landType match (borrow from similarity weight)
    if (land.landType && Object.keys(landTypeCounts).length > 0) {
      const maxTypeWeight = Math.max(...Object.values(landTypeCounts), 1);
      const typeWeight = landTypeCounts[land.landType] || 0;
      if (typeWeight > 0) {
        score += (typeWeight / maxTypeWeight) * 0.1;
        reasons.push('Loại đất phù hợp');
      }
    }

    return { score: Math.min(score, 1), reasons };
  }

  // ==================== FALLBACK: POPULAR / RECENT ====================

  private async getPopularHouses(limit: number) {
    const popularIds = await this.prisma.favorite.groupBy({
      by: ['houseId'],
      where: { houseId: { not: null } },
      _count: { houseId: true },
      orderBy: { _count: { houseId: 'desc' } },
      take: limit,
    });

    if (popularIds.length > 0) {
      const houses = await this.prisma.house.findMany({
        where: {
          id: { in: popularIds.map((p) => p.houseId!).filter(Boolean) },
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
      return houses.map((h) => ({
        ...h,
        recommendationScore: 0.5,
        recommendationReason: 'Được nhiều người quan tâm',
      }));
    }

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

  private async getPopularLands(limit: number) {
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

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
