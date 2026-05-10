/**
 * ==================== VECTOR SERVICE ====================
 * Xử lý phần AI: tạo User Embedding Vector và tìm BĐS tương tự.
 *
 * Công nghệ:
 *   - Qdrant: Vector Database lưu embedding của tất cả BĐS
 *   - Ollama (nomic-embed-text): Chuyển text → vector 768 chiều (fallback)
 *
 * Luồng chính:
 *   1. buildUserVector()  → Tạo vector đại diện sở thích user
 *   2. vectorSearch()     → Tìm BĐS có vector gần user nhất (cosine similarity)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  WeightedInteraction,
  VectorSearchResult,
} from '../interfaces/recommendation.interfaces';
import {
  EMBEDDING_CACHE_TTL,
  EMBEDDING_CONFIG,
  QUERY_LIMITS,
} from '../constants/recommendation.constants';
import { cacheKeys } from '../constants/recommendation.constants';

@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);

  // Các URL và cấu hình được lấy từ .env qua ConfigService
  private readonly qdrantUrl: string; // URL của Qdrant (Vector DB)
  private readonly ollamaUrl: string; // URL của Ollama (LLM embed)
  private readonly ragCollection: string; // Tên collection trong Qdrant
  private readonly embedModel: string; // Model embedding (nomic-embed-text)
  private readonly qdrantTimeoutMs: number; // Timeout gọi Qdrant (ms)
  private readonly embedTimeoutMs: number; // Timeout gọi Ollama (ms)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    // Đọc cấu hình từ .env, có giá trị mặc định nếu chưa set
    this.qdrantUrl = this.config.get<string>(
      'QDRANT_URL',
      'http://real-estate-qdrant:6333',
    );
    this.ollamaUrl = this.config.get<string>(
      'OLLAMA_URL',
      'http://host.docker.internal:11434',
    );
    this.ragCollection = this.config.get<string>(
      'RAG_COLLECTION',
      'real_estate_rag',
    );
    this.embedModel = this.config.get<string>(
      'EMBED_MODEL',
      'nomic-embed-text',
    );
    this.qdrantTimeoutMs = this.config.get<number>('QDRANT_TIMEOUT_MS', 2500);
    this.embedTimeoutMs = this.config.get<number>('EMBED_TIMEOUT_MS', 5000);
  }

  /**
   * Tạo User Embedding Vector — vector 768 chiều đại diện sở thích user.
   *
   * Cách hoạt động:
   *   1. Kiểm tra cache Redis (TTL = 1 giờ)
   *   2. Lấy vector của các BĐS user đã tương tác từ Qdrant
   *   3. Tính TRUNG BÌNH CÓ TRỌNG SỐ → ra 1 vector duy nhất
   *   4. Fallback: nếu Qdrant không có → tạo text mô tả → Ollama embed
   *
   * Ví dụ trung bình có trọng số:
   *   User SAVE nhà A (weight=3, vector=[0.1, 0.8, ...])
   *   User CLICK nhà B (weight=2, vector=[0.5, 0.3, ...])
   *   → userVector = ([0.1,0.8]×3 + [0.5,0.3]×2) / (3+2)
   *                = ([0.3,2.4] + [1.0,0.6]) / 5
   *                = [1.3, 3.0] / 5
   *                = [0.26, 0.60, ...]
   *   → Vector "nghiêng" về nhà A vì user quan tâm hơn (weight cao hơn)
   */
  async buildUserVector(
    userId: number,
    interactions: WeightedInteraction[],
  ): Promise<number[] | null> {
    // Bước 1: Kiểm tra cache — nếu đã tính rồi thì dùng lại (1 giờ)
    const vecCacheKey = cacheKeys.userVector(userId);
    const cachedVector = await this.redis
      .get<number[]>(vecCacheKey)
      .catch(() => null);
    if (Array.isArray(cachedVector) && cachedVector.length > 0) {
      this.logger.debug(`User vector cache HIT for user ${userId}`);
      return cachedVector;
    }

    // Bước 2: Lấy vector của các BĐS từ Qdrant theo point ID
    // VD: interactions = [{qdrantId: 1000005}, {qdrantId: 1000012}]
    //     → Gọi Qdrant: "cho tôi vector của point 1000005 và 1000012"
    const qdrantIds = interactions.map((i) => i.qdrantId);
    let pointVectors: Array<{ id: number; vector: number[] }> = [];

    try {
      const resp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points`,
        { ids: qdrantIds, with_vector: true },
        { timeout: this.qdrantTimeoutMs },
      );

      const points = resp.data?.result || [];
      // Chỉ giữ những point có vector hợp lệ
      pointVectors = points
        .filter((p: any) => Array.isArray(p.vector) && p.vector.length > 0)
        .map((p: any) => ({ id: Number(p.id), vector: p.vector as number[] }));
    } catch (error) {
      // Qdrant lỗi → không crash, tiếp tục với fallback
      this.logger.warn(
        `Failed to fetch point vectors from Qdrant: ${this.stringifyError(error)}`,
      );
    }

    // Bước 3 (Fallback): Không lấy được vector từ Qdrant
    // → Tạo đoạn text mô tả sở thích → gửi Ollama embed thành vector
    if (pointVectors.length === 0) {
      const fallbackVector = await this.buildUserVectorFromText(interactions);
      if (fallbackVector) {
        await this.redis
          .set(vecCacheKey, fallbackVector, EMBEDDING_CACHE_TTL)
          .catch((err) => {
            this.logger.warn(`Redis cache set failed: ${err.message}`);
          });
      }
      return fallbackVector;
    }

    // Bước 4: Tính trung bình có trọng số (weighted average)
    const weightMap = new Map(interactions.map((i) => [i.qdrantId, i.weight]));
    const vectorDim = pointVectors[0].vector.length; // 768 chiều
    const avgVector = new Array<number>(vectorDim).fill(0);
    let totalWeight = 0;

    for (const pv of pointVectors) {
      const w = weightMap.get(pv.id) || 1; // Trọng số của tương tác này
      totalWeight += w;
      for (let i = 0; i < vectorDim; i++) {
        avgVector[i] += pv.vector[i] * w; // Cộng dồn: vector × weight
      }
    }

    // Chia cho tổng trọng số → ra trung bình
    if (totalWeight > 0) {
      for (let i = 0; i < vectorDim; i++) {
        avgVector[i] /= totalWeight;
      }
    }

    // Cache kết quả 1 giờ
    await this.redis
      .set(vecCacheKey, avgVector, EMBEDDING_CACHE_TTL)
      .catch((err) => {
        this.logger.warn(`Redis cache set failed: ${err.message}`);
      });
    this.logger.debug(
      `Built user vector from ${pointVectors.length} embeddings (${interactions.length} interactions)`,
    );

    return avgVector;
  }

  /**
   * Fallback: Tạo user vector từ TEXT khi Qdrant không có vector sẵn.
   *
   * Cách hoạt động:
   *   1. Lấy top 10 BĐS user tương tác mạnh nhất
   *   2. Tạo đoạn text mô tả: "Nguoi dung quan tam: Nha Q7 gia 5ty, Dat Q9 gia 2ty..."
   *   3. Gửi text → Ollama (model nomic-embed-text) → nhận vector 768 chiều
   */
  private async buildUserVectorFromText(
    interactions: WeightedInteraction[],
  ): Promise<number[] | null> {
    // Lấy top 10 tương tác có trọng số cao nhất
    const topInteractions = interactions
      .sort((a, b) => b.weight - a.weight)
      .slice(0, QUERY_LIMITS.TOP_INTERACTIONS_FOR_TEXT);

    // Tách ra nhà và đất
    const houseIds = topInteractions
      .filter((i) => i.type === 'house')
      .map((i) => i.id);
    const landIds = topInteractions
      .filter((i) => i.type === 'land')
      .map((i) => i.id);

    // Query thông tin BĐS từ MySQL
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

    // Ghép thành 1 đoạn text mô tả sở thích user
    // VD: "Nguoi dung quan tam: Nha: Nha pho Q7, Q7 HCM, gia 5000000000, dt 100"
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

    // Gửi text lên Ollama để embed thành vector
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

  /**
   * Tìm BĐS tương tự bằng Vector Search trên Qdrant.
   *
   * Cách hoạt động:
   *   1. Gửi userVector lên Qdrant
   *   2. Qdrant tính cosine similarity với tất cả BĐS trong collection
   *   3. Trả về top N BĐS có score cao nhất
   *   4. Loại trừ BĐS user đã tương tác (không gợi ý lại)
   *   5. Chỉ giữ kết quả có score > 0.1 (loại noise)
   *
   * @param userVector - Vector 768 chiều đại diện sở thích user
   * @param candidateLimit - Số kết quả tối đa (VD: 100)
   * @param excludeInteractions - Danh sách BĐS đã xem (loại trừ)
   */
  async vectorSearch(
    userVector: number[],
    candidateLimit: number,
    excludeInteractions: WeightedInteraction[],
  ): Promise<VectorSearchResult[]> {
    try {
      // Danh sách qdrantId cần loại trừ
      const excludeIds = excludeInteractions.map((i) => i.qdrantId);

      // Gọi Qdrant API: tìm vector gần nhất
      const resp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points/search`,
        {
          vector: userVector, // Vector sở thích user
          limit: candidateLimit, // Lấy top 100
          with_payload: true, // Kèm metadata (source, sourceId, district...)
          filter:
            excludeIds.length > 0
              ? { must_not: [{ has_id: excludeIds }] } // Loại trừ đã xem
              : undefined,
        },
        { timeout: this.qdrantTimeoutMs },
      );

      const results = (resp.data?.result || []) as Array<{
        id: number;
        score: number; // Cosine similarity (0 → 1)
        payload: Record<string, unknown>;
      }>;

      // Lọc: chỉ giữ house/land có score đủ cao (> 0.1)
      return results
        .filter((r) => {
          const source = String(r.payload?.source || '');
          return (
            (source === 'house' || source === 'land') &&
            r.score > EMBEDDING_CONFIG.MIN_SCORE_THRESHOLD
          );
        })
        .map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
    } catch (error) {
      // Qdrant lỗi → trả mảng rỗng, fallback về rule-based
      this.logger.warn(`Vector search failed: ${this.stringifyError(error)}`);
      return [];
    }
  }

  /** Helper: chuyển error bất kỳ thành string để log */
  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
