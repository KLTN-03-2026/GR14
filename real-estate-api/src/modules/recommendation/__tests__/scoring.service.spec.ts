import { ScoringService } from '../services/scoring.service';
import {
  UserProfile,
  HybridScoredProperty,
} from '../interfaces/recommendation.interfaces';

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(() => {
    service = new ScoringService();
  });

  // ==================== calculateScore ====================

  describe('calculateScore', () => {
    const baseProfile: UserProfile = {
      avgPrice: 5_000_000_000, // 5 tỷ
      avgArea: 100,
      locationCounts: { 'HCM|Quận 7': 5, 'HN|Cầu Giấy': 2 },
      categoryCounts: { 1: 5, 2: 2 },
      totalWeight: 10,
    };

    it('should return score > 0 for a matching property', () => {
      const property = {
        id: 1,
        price: 5_000_000_000,
        city: 'HCM',
        district: 'Quận 7',
        area: 100,
        categoryId: 1,
        createdAt: new Date(),
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should give high score when price matches exactly', () => {
      const property = {
        id: 1,
        price: 5_000_000_000,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, baseProfile);
      // Price match = 1.0, contributes 0.3
      expect(result.score).toBeGreaterThanOrEqual(0.3);
      expect(result.reasons).toContain('Mức giá phù hợp');
    });

    it('should give low score when price is very different', () => {
      const property = {
        id: 1,
        price: 50_000_000_000, // 50 tỷ — 10x higher
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, baseProfile);
      // Price diff = 9.0, priceScore = max(0, 1-9) = 0
      expect(result.score).toBeLessThan(0.1);
    });

    it('should handle price = 0 in profile gracefully', () => {
      const profile: UserProfile = {
        ...baseProfile,
        avgPrice: 0,
      };
      const property = {
        id: 1,
        price: 5_000_000_000,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, profile);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing property fields gracefully', () => {
      const property = {
        id: 1,
        price: null,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should add "Khu vực bạn quan tâm" reason for matching location', () => {
      const property = {
        id: 1,
        price: null,
        city: 'HCM',
        district: 'Quận 7',
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.reasons).toContain('Khu vực bạn quan tâm');
    });

    it('should add "Khám phá khu vực mới" for unknown location', () => {
      const property = {
        id: 1,
        price: null,
        city: 'Đà Nẵng',
        district: 'Hải Châu',
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.reasons).toContain('Khám phá khu vực mới');
    });

    it('should add freshness boost for recently created property', () => {
      const property = {
        id: 1,
        price: null,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date(), // today
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.reasons).toContain('Mới đăng');
    });

    it('should cap score at 1.0', () => {
      const property = {
        id: 1,
        price: 5_000_000_000,
        city: 'HCM',
        district: 'Quận 7',
        area: 100,
        categoryId: 1,
        createdAt: new Date(),
      };
      const result = service.calculateScore(property, baseProfile);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should fallback to "Có thể phù hợp với bạn" when no specific reason', () => {
      const emptyProfile: UserProfile = {
        avgPrice: 0,
        avgArea: 0,
        locationCounts: {},
        categoryCounts: {},
        totalWeight: 0,
      };
      const property = {
        id: 1,
        price: null,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
      };
      const result = service.calculateScore(property, emptyProfile);
      expect(result.reasons).toContain('Có thể phù hợp với bạn');
    });
  });

  // ==================== calculateLandScore ====================

  describe('calculateLandScore', () => {
    const profile: UserProfile = {
      avgPrice: 3_000_000_000,
      avgArea: 200,
      locationCounts: { 'HCM|Bình Chánh': 3 },
      categoryCounts: { 3: 3 },
      totalWeight: 5,
    };

    it('should add land type bonus when matching', () => {
      const land = {
        id: 1,
        price: 3_000_000_000,
        city: 'HCM',
        district: 'Bình Chánh',
        area: 200,
        categoryId: 3,
        createdAt: new Date('2020-01-01'),
        landType: 'Đất thổ cư',
      };
      const landTypeCounts = { 'Đất thổ cư': 5, 'Đất nông nghiệp': 1 };

      const result = service.calculateLandScore(land, profile, landTypeCounts);
      expect(result.reasons).toContain('Loại đất phù hợp');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should not add land type bonus when type does not match', () => {
      const land = {
        id: 1,
        price: 3_000_000_000,
        city: null,
        district: null,
        area: null,
        categoryId: null,
        createdAt: new Date('2020-01-01'),
        landType: 'Đất rừng',
      };
      const landTypeCounts = { 'Đất thổ cư': 5 };

      const result = service.calculateLandScore(land, profile, landTypeCounts);
      expect(result.reasons).not.toContain('Loại đất phù hợp');
    });
  });

  // ==================== normalizeEmbeddingScore ====================

  describe('normalizeEmbeddingScore', () => {
    it('should normalize 1.0 to 1.0', () => {
      expect(service.normalizeEmbeddingScore(1.0)).toBe(1);
    });

    it('should normalize 0.2 (floor) to 0.0', () => {
      expect(service.normalizeEmbeddingScore(0.2)).toBe(0);
    });

    it('should normalize values below floor to 0.0', () => {
      expect(service.normalizeEmbeddingScore(0.1)).toBe(0);
      expect(service.normalizeEmbeddingScore(0)).toBe(0);
    });

    it('should normalize 0.6 to ~0.5', () => {
      expect(service.normalizeEmbeddingScore(0.6)).toBeCloseTo(0.5, 5);
    });
  });

  // ==================== priceBucket ====================

  describe('priceBucket', () => {
    it('should return "na" for price <= 0', () => {
      expect(service.priceBucket(0)).toBe('na');
      expect(service.priceBucket(-100)).toBe('na');
    });

    it('should return correct bucket for each range', () => {
      expect(service.priceBucket(500_000_000)).toBe('under1ty');
      expect(service.priceBucket(2_000_000_000)).toBe('1-3ty');
      expect(service.priceBucket(4_000_000_000)).toBe('3-5ty');
      expect(service.priceBucket(7_000_000_000)).toBe('5-10ty');
      expect(service.priceBucket(15_000_000_000)).toBe('over10ty');
    });
  });

  // ==================== applyDiversity ====================

  describe('applyDiversity', () => {
    it('should limit items per diversity bucket', () => {
      // Create 5 items in the same bucket
      const items: HybridScoredProperty[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: i + 1,
          type: 'house' as const,
          district: 'Quận 7',
          price: 2_000_000_000,
          embeddingScore: 0.8,
          ruleScore: 0.7 - i * 0.05,
          finalScore: 0.75 - i * 0.05,
          reasons: ['Test'],
        }),
      );

      const result = service.applyDiversity(items, 5);
      expect(result.length).toBe(5);
      // First 3 should be from the bucket (MAX_PER_BUCKET = 3), rest deferred
    });

    it('should not exceed limit', () => {
      const items: HybridScoredProperty[] = Array.from(
        { length: 20 },
        (_, i) => ({
          id: i + 1,
          type: 'house' as const,
          district: `District ${i}`,
          price: 2_000_000_000,
          embeddingScore: 0.5,
          ruleScore: 0.5,
          finalScore: 0.5,
          reasons: [],
        }),
      );

      const result = service.applyDiversity(items, 10);
      expect(result.length).toBe(10);
    });

    it('should return empty array for empty input', () => {
      const result = service.applyDiversity([], 10);
      expect(result).toEqual([]);
    });

    it('should mix different districts/types for diversity', () => {
      const items: HybridScoredProperty[] = [
        {
          id: 1,
          type: 'house',
          district: 'Q1',
          price: 2e9,
          embeddingScore: 0,
          ruleScore: 0,
          finalScore: 0.9,
          reasons: [],
        },
        {
          id: 2,
          type: 'house',
          district: 'Q1',
          price: 2e9,
          embeddingScore: 0,
          ruleScore: 0,
          finalScore: 0.89,
          reasons: [],
        },
        {
          id: 3,
          type: 'house',
          district: 'Q1',
          price: 2e9,
          embeddingScore: 0,
          ruleScore: 0,
          finalScore: 0.88,
          reasons: [],
        },
        {
          id: 4,
          type: 'house',
          district: 'Q1',
          price: 2e9,
          embeddingScore: 0,
          ruleScore: 0,
          finalScore: 0.87,
          reasons: [],
        },
        {
          id: 5,
          type: 'land',
          district: 'Q2',
          price: 3e9,
          embeddingScore: 0,
          ruleScore: 0,
          finalScore: 0.85,
          reasons: [],
        },
      ];

      const result = service.applyDiversity(items, 4);
      // Should take 3 from Q1 bucket, then id:5 from Q2
      expect(result.length).toBe(4);
      expect(result[3].district).toBe('Q2');
    });
  });
});
