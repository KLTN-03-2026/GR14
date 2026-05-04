import { UserProfileService } from '../services/user-profile.service';
import { WeightedItem } from '../interfaces/recommendation.interfaces';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    // UserProfileService depends on PrismaService, but buildUserProfile
    // and buildCandidateFilters are pure logic methods
    service = new UserProfileService(null as any);
  });

  // ==================== buildUserProfile ====================

  describe('buildUserProfile', () => {
    it('should calculate weighted average price', () => {
      const items: WeightedItem[] = [
        { id: 1, price: 2_000_000_000, city: null, district: null, area: null, categoryId: null, weight: 1 },
        { id: 2, price: 4_000_000_000, city: null, district: null, area: null, categoryId: null, weight: 3 },
      ];
      const profile = service.buildUserProfile(items);
      // weighted avg = (2e9*1 + 4e9*3) / (1+3) = 14e9/4 = 3.5e9
      expect(profile.avgPrice).toBe(3_500_000_000);
    });

    it('should calculate weighted average area', () => {
      const items: WeightedItem[] = [
        { id: 1, price: null, city: null, district: null, area: 80, categoryId: null, weight: 2 },
        { id: 2, price: null, city: null, district: null, area: 120, categoryId: null, weight: 2 },
      ];
      const profile = service.buildUserProfile(items);
      // weighted avg = (80*2 + 120*2) / (2+2) = 400/4 = 100
      expect(profile.avgArea).toBe(100);
    });

    it('should count locations by weight', () => {
      const items: WeightedItem[] = [
        { id: 1, price: null, city: 'HCM', district: 'Q7', area: null, categoryId: null, weight: 3 },
        { id: 2, price: null, city: 'HCM', district: 'Q7', area: null, categoryId: null, weight: 2 },
        { id: 3, price: null, city: 'HN', district: 'CG', area: null, categoryId: null, weight: 1 },
      ];
      const profile = service.buildUserProfile(items);
      expect(profile.locationCounts['HCM|Q7']).toBe(5);
      expect(profile.locationCounts['HN|CG']).toBe(1);
    });

    it('should count categories by weight', () => {
      const items: WeightedItem[] = [
        { id: 1, price: null, city: null, district: null, area: null, categoryId: 1, weight: 3 },
        { id: 2, price: null, city: null, district: null, area: null, categoryId: 1, weight: 2 },
        { id: 3, price: null, city: null, district: null, area: null, categoryId: 2, weight: 1 },
      ];
      const profile = service.buildUserProfile(items);
      expect(profile.categoryCounts[1]).toBe(5);
      expect(profile.categoryCounts[2]).toBe(1);
    });

    it('should handle empty items', () => {
      const profile = service.buildUserProfile([]);
      expect(profile.avgPrice).toBe(0);
      expect(profile.avgArea).toBe(0);
      expect(profile.totalWeight).toBe(0);
      expect(Object.keys(profile.locationCounts)).toHaveLength(0);
    });

    it('should skip null prices and areas in averaging', () => {
      const items: WeightedItem[] = [
        { id: 1, price: null, city: null, district: null, area: null, categoryId: null, weight: 3 },
        { id: 2, price: 5_000_000_000, city: null, district: null, area: 100, categoryId: null, weight: 1 },
      ];
      const profile = service.buildUserProfile(items);
      expect(profile.avgPrice).toBe(5_000_000_000);
      expect(profile.avgArea).toBe(100);
    });
  });

  // ==================== buildCandidateFilters ====================

  describe('buildCandidateFilters', () => {
    it('should build price range filter (±50%)', () => {
      const profile = service.buildUserProfile([
        { id: 1, price: 4_000_000_000, city: null, district: null, area: null, categoryId: null, weight: 1 },
      ]);
      const filters = service.buildCandidateFilters(profile);
      const priceFilter = filters.find((f: any) => f.price);
      expect(priceFilter).toBeDefined();
      expect(priceFilter.price.gte).toBe(2_000_000_000); // 50% lower
      expect(priceFilter.price.lte).toBe(6_000_000_000); // 50% higher
    });

    it('should include top locations as filters', () => {
      const profile = service.buildUserProfile([
        { id: 1, price: null, city: 'HCM', district: 'Q7', area: null, categoryId: null, weight: 1 },
      ]);
      const filters = service.buildCandidateFilters(profile);
      const locationFilter = filters.find((f: any) => f.city && f.district);
      expect(locationFilter).toBeDefined();
      expect(locationFilter.city).toBe('HCM');
      expect(locationFilter.district).toBe('Q7');
    });

    it('should include category filter', () => {
      const profile = service.buildUserProfile([
        { id: 1, price: null, city: null, district: null, area: null, categoryId: 5, weight: 1 },
      ]);
      const filters = service.buildCandidateFilters(profile);
      const catFilter = filters.find((f: any) => f.categoryId);
      expect(catFilter).toBeDefined();
      expect(catFilter.categoryId.in).toContain(5);
    });

    it('should return [{}] fallback when no data', () => {
      const profile = service.buildUserProfile([]);
      const filters = service.buildCandidateFilters(profile);
      expect(filters).toEqual([{}]);
    });
  });
});
