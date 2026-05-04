/**
 * ==================== SCORING SERVICE ====================
 * Chấm điểm từng BĐS ứng viên dựa trên hồ sơ sở thích của user.
 * Đây là phần "Rule-based" trong hệ thống Hybrid Recommendation.
 *
 * Chức năng chính:
 *   1. calculateScore()         → Chấm điểm nhà (4 tiêu chí)
 *   2. calculateLandScore()     → Chấm điểm đất (thêm bonus loại đất)
 *   3. normalizeEmbeddingScore() → Chuẩn hóa điểm AI về [0,1]
 *   4. applyDiversity()         → Đa dạng hóa kết quả (tránh trùng lặp)
 */
import { Injectable } from '@nestjs/common';
import {
  UserProfile,
  ScoreResult,
  HybridScoredProperty,
  PropertyCandidate,
} from '../interfaces/recommendation.interfaces';
import {
  SCORING_WEIGHTS,
  EMBEDDING_CONFIG,
  PRICE_BUCKETS,
  DIVERSITY_CONFIG,
} from '../constants/recommendation.constants';

@Injectable()
export class ScoringService {
  /**
   * Chấm điểm 1 BĐS (nhà) so với hồ sơ sở thích user.
   * Điểm từ 0 → 1, gồm 4 thành phần:
   *   - Giá phù hợp     (30%)
   *   - Khu vực quen     (30%)
   *   - Tương đồng       (30%)
   *   - Đa dạng + Mới    (10%)
   *
   * @param property - BĐS ứng viên cần chấm điểm
   * @param profile  - Hồ sơ sở thích user (đã build từ hành vi)
   * @returns { score: number, reasons: string[] }
   */
  calculateScore(
    property: PropertyCandidate,
    profile: UserProfile,
  ): ScoreResult {
    let score = 0;
    const reasons: string[] = [];

    // ═══════════════════════════════════════════════════════
    // 1. ĐIỂM GIÁ (30%) — Giá BĐS có gần với giá user thích không?
    // ═══════════════════════════════════════════════════════
    // Công thức: priceScore = max(0, 1 - |giá_BĐS - giá_TB| / giá_TB)
    // VD: User thích 5 tỷ, BĐS = 4 tỷ
    //     → diff = |4-5|/5 = 0.2 → score = 1 - 0.2 = 0.8 (rất phù hợp!)
    // VD: User thích 5 tỷ, BĐS = 15 tỷ
    //     → diff = |15-5|/5 = 2.0 → score = max(0, 1-2) = 0 (không phù hợp)
    if (profile.avgPrice > 0 && property.price) {
      const propPrice = Number(property.price);
      const priceDiff =
        Math.abs(propPrice - profile.avgPrice) / profile.avgPrice;
      const priceScore = Math.max(0, 1 - priceDiff);
      score += priceScore * SCORING_WEIGHTS.PRICE_MATCH; // × 0.3
      if (priceScore > 0.6) reasons.push('Mức giá phù hợp');
    }

    // ═══════════════════════════════════════════════════════
    // 2. ĐIỂM KHU VỰC (30%) — BĐS có ở khu vực user hay xem không?
    // ═══════════════════════════════════════════════════════
    // So sánh (city + district) của BĐS với bảng tần suất khu vực user.
    // VD: locationCounts = {"HCM|Q7": 5, "HN|CG": 2}
    //     BĐS ở Q7 → locationWeight = 5, max = 5 → score = 5/5 = 1.0
    //     BĐS ở CG → locationWeight = 2, max = 5 → score = 2/5 = 0.4
    //     BĐS ở Đà Nẵng → locationWeight = 0 → score = 0 (chưa từng xem)
    if (property.city && property.district) {
      const locationKey = `${property.city}|${property.district}`;
      const maxLocationWeight = Math.max(
        ...Object.values(profile.locationCounts),
        1,
      );
      const locationWeight = profile.locationCounts[locationKey] || 0;
      const locationScore = locationWeight / maxLocationWeight;
      score += locationScore * SCORING_WEIGHTS.LOCATION_MATCH; // × 0.3
      if (locationScore > 0.5) reasons.push('Khu vực bạn quan tâm');
    }

    // ═══════════════════════════════════════════════════════
    // 3. ĐIỂM TƯƠNG ĐỒNG (30%) — Category + Diện tích giống không?
    // ═══════════════════════════════════════════════════════
    let similarityScore = 0;
    let similarityCount = 0;

    // 3a. Category match: BĐS cùng loại (nhà phố, chung cư, biệt thự...)
    // VD: User xem 5 "nhà phố" (catId=1), 2 "chung cư" (catId=2)
    //     BĐS catId=1 → score = 5/5 × 0.4 = 0.4
    if (property.categoryId && profile.categoryCounts[property.categoryId]) {
      const maxCatWeight = Math.max(
        ...Object.values(profile.categoryCounts),
        1,
      );
      similarityScore +=
        (profile.categoryCounts[property.categoryId] / maxCatWeight) *
        SCORING_WEIGHTS.CATEGORY_SUB_WEIGHT; // × 0.4
      similarityCount++;
    }

    // 3b. Area match: Diện tích gần với trung bình user thích
    // VD: User thích 100m², BĐS = 95m² → diff = 5/100 = 0.05 → score = 0.95
    if (profile.avgArea > 0 && property.area) {
      const areaDiff =
        Math.abs(Number(property.area) - profile.avgArea) / profile.avgArea;
      similarityScore +=
        Math.max(0, 1 - areaDiff) * SCORING_WEIGHTS.AREA_SUB_WEIGHT; // × 0.3
      similarityCount++;
    }

    // Gộp điểm tương đồng vào tổng (× 0.3)
    if (similarityCount > 0) {
      score +=
        (similarityScore / similarityCount) *
        similarityCount *
        SCORING_WEIGHTS.SIMILARITY;
      if (similarityScore > 0.3) reasons.push('Giống các BĐS bạn đã xem');
    }

    // ═══════════════════════════════════════════════════════
    // 4. BONUS ĐA DẠNG + MỚI (10%)
    // ═══════════════════════════════════════════════════════

    // 4a. Diversity bonus: BĐS ở khu vực user CHƯA từng xem → khám phá mới
    if (property.city && property.district) {
      const locationKey = `${property.city}|${property.district}`;
      if (!profile.locationCounts[locationKey]) {
        score += SCORING_WEIGHTS.DIVERSITY_BONUS; // +0.05
        reasons.push('Khám phá khu vực mới');
      }
    }

    // 4b. Freshness bonus: BĐS mới đăng trong 7 ngày → ưu tiên tin mới
    const daysSinceCreated =
      (Date.now() - new Date(property.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSinceCreated < SCORING_WEIGHTS.FRESHNESS_DAYS) {
      score += SCORING_WEIGHTS.DIVERSITY_BONUS; // +0.05
      reasons.push('Mới đăng');
    }

    // Nếu không có lý do cụ thể → fallback message
    if (reasons.length === 0) reasons.push('Có thể phù hợp với bạn');

    // Giới hạn điểm tối đa = 1.0
    return { score: Math.min(score, 1), reasons };
  }

  /**
   * Chấm điểm BĐS loại ĐẤT — mở rộng từ calculateScore().
   * Thêm bonus nếu loại đất (thổ cư, nông nghiệp...) khớp với sở thích user.
   *
   * VD: User xem 5 lần "Đất thổ cư", 1 lần "Đất nông nghiệp"
   *     → BĐS "Đất thổ cư" được bonus: 5/5 × 0.1 = +0.1 điểm
   */
  calculateLandScore(
    land: PropertyCandidate,
    profile: UserProfile,
    landTypeCounts: Record<string, number>,
  ): ScoreResult {
    // Tính điểm cơ bản (giống nhà)
    const { score: baseScore, reasons } = this.calculateScore(land, profile);
    let score = baseScore;

    // Bonus: loại đất phù hợp
    if (land.landType && Object.keys(landTypeCounts).length > 0) {
      const maxTypeWeight = Math.max(...Object.values(landTypeCounts), 1);
      const typeWeight = landTypeCounts[land.landType] || 0;
      if (typeWeight > 0) {
        score += (typeWeight / maxTypeWeight) * SCORING_WEIGHTS.LAND_TYPE_BONUS;
        reasons.push('Loại đất phù hợp');
      }
    }

    return { score: Math.min(score, 1), reasons };
  }

  /**
   * Chuẩn hóa điểm cosine similarity từ Qdrant về khoảng [0, 1].
   *
   * Qdrant trả score thô (0 → 1). Nhưng score < 0.2 thường là noise (không liên quan).
   * → Dùng công thức: normalized = (raw - 0.2) / (1 - 0.2)
   *
   * VD: raw = 0.2  → (0.2 - 0.2) / 0.8 = 0     (sàn, không liên quan)
   * VD: raw = 0.6  → (0.6 - 0.2) / 0.8 = 0.5   (trung bình)
   * VD: raw = 1.0  → (1.0 - 0.2) / 0.8 = 1.0   (rất phù hợp)
   */
  normalizeEmbeddingScore(raw: number): number {
    return Math.max(
      0,
      (raw - EMBEDDING_CONFIG.NORMALIZATION_FLOOR) /
        (1 - EMBEDDING_CONFIG.NORMALIZATION_FLOOR),
    );
  }

  /**
   * Phân nhóm giá BĐS vào các bucket để phục vụ diversity filter.
   * VD: 2 tỷ → "1-3ty", 7 tỷ → "5-10ty", 500 triệu → "under1ty"
   */
  priceBucket(price: number): string {
    if (price <= 0) return 'na';
    if (price < PRICE_BUCKETS.UNDER_1B) return 'under1ty';
    if (price < PRICE_BUCKETS.UNDER_3B) return '1-3ty';
    if (price < PRICE_BUCKETS.UNDER_5B) return '3-5ty';
    if (price < PRICE_BUCKETS.UNDER_10B) return '5-10ty';
    return 'over10ty';
  }

  /**
   * Tạo key nhóm đa dạng: "quận | tầm giá | loại"
   * VD: BĐS ở Q7, giá 4 tỷ, loại house → "Q7|3-5ty|house"
   */
  diversityBucket(item: HybridScoredProperty): string {
    const district = item.district || 'unknown';
    const bucket = this.priceBucket(item.price);
    return `${district}|${bucket}|${item.type}`;
  }

  /**
   * Đa dạng hóa kết quả gợi ý — tránh top N toàn BĐS giống nhau.
   *
   * Thuật toán:
   *   1. Duyệt danh sách đã sort theo điểm giảm dần
   *   2. Mỗi BĐS thuộc 1 "bucket" (quận + tầm giá + loại)
   *   3. Mỗi bucket chỉ được tối đa 3 BĐS (MAX_PER_BUCKET)
   *   4. BĐS bị dư → đẩy vào deferred
   *   5. Sau khi duyệt hết → lấp chỗ trống bằng deferred
   *
   * VD input (đã sort):  [Q7-3ty, Q7-3ty, Q7-3ty, Q7-3ty, Q2-5ty]
   * VD output (limit=4): [Q7-3ty, Q7-3ty, Q7-3ty, Q2-5ty]
   *                       (3 cái Q7 + 1 cái Q2, cái Q7 thứ 4 bị bỏ)
   */
  applyDiversity(
    scored: HybridScoredProperty[],
    limit: number,
  ): HybridScoredProperty[] {
    const result: HybridScoredProperty[] = [];
    const bucketCount = new Map<string, number>();
    const maxPerBucket = DIVERSITY_CONFIG.MAX_PER_BUCKET;
    const deferred: HybridScoredProperty[] = [];

    // Vòng 1: lấy BĐS theo thứ tự điểm, giới hạn mỗi bucket
    for (const item of scored) {
      if (result.length >= limit) break;

      const bucket = this.diversityBucket(item);
      const count = bucketCount.get(bucket) || 0;
      if (count >= maxPerBucket) {
        deferred.push(item); // Bucket đầy → đẩy xuống cuối
        continue;
      }
      bucketCount.set(bucket, count + 1);
      result.push(item); // Còn slot → lấy
    }

    // Vòng 2: lấp chỗ trống bằng BĐS bị deferred
    for (const item of deferred) {
      if (result.length >= limit) break;
      result.push(item);
    }

    return result;
  }
}
