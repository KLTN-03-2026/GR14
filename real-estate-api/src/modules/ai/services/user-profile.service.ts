import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { UserProfile, ParsedIntent, ChatTurn } from '../types/ai.types';
import { AiUtils } from '../utils/ai.utils';

/**
 * Manages persistent user profiles across sessions.
 * Learns user preferences from interactions and filters out previously viewed/disliked properties.
 */
@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);
  private readonly profileTtlSec = Number(process.env.USER_PROFILE_TTL || 7 * 24 * 3600); // 7 days

  constructor(private readonly redis: RedisService) {}

  private profileKey(sessionId: string): string {
    return `ai:profile:${sessionId}`;
  }

  async getProfile(sessionId: string): Promise<UserProfile> {
    const cached = await this.redis.get<UserProfile>(this.profileKey(sessionId));
    if (cached) return cached;

    return this.createEmptyProfile(sessionId);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    profile.lastActiveAt = new Date().toISOString();
    await this.redis.set(this.profileKey(profile.sessionId), profile, this.profileTtlSec);
  }

  /**
   * Learn from each interaction: extract preferences from intent and update profile.
   */
  async learnFromInteraction(
    sessionId: string,
    intent: ParsedIntent,
    viewedSourceIds: number[],
    question: string,
  ): Promise<UserProfile> {
    const profile = await this.getProfile(sessionId);

    // Update budget preferences
    if (intent.maxPrice !== undefined) {
      profile.budgetMax = intent.maxPrice;
    }
    if (intent.minPrice !== undefined) {
      profile.budgetMin = intent.minPrice;
    }

    // Update location preferences
    if (intent.location) {
      const normalizedLoc = intent.location.toLowerCase().trim();
      if (!profile.preferredAreas.includes(normalizedLoc)) {
        profile.preferredAreas.push(normalizedLoc);
        // Keep only last 5 areas
        if (profile.preferredAreas.length > 5) {
          profile.preferredAreas = profile.preferredAreas.slice(-5);
        }
      }
    }

    // Update property type preference
    if (intent.sourceType && intent.sourceType !== 'post') {
      profile.propertyType = intent.sourceType;
    }

    // Update transaction type
    if (intent.transactionType) {
      profile.transactionType = intent.transactionType;
    }

    // Update purpose
    if (intent.purpose) {
      profile.purpose = intent.purpose;
    }

    // Track viewed properties
    for (const id of viewedSourceIds) {
      if (!profile.viewedPropertyIds.includes(id)) {
        profile.viewedPropertyIds.push(id);
        // Keep last 50
        if (profile.viewedPropertyIds.length > 50) {
          profile.viewedPropertyIds = profile.viewedPropertyIds.slice(-50);
        }
      }
    }

    // Extract and accumulate keywords
    const normalized = AiUtils.normalizeText(question);
    const keywordPatterns = [
      /\b(mat tien|hem|view bien|gara|san vuon|ho boi|thang may|nha pho)\b/g,
      /\b(gan truong|gan cho|gan benh vien|trung tam|yen tinh)\b/g,
    ];
    for (const pattern of keywordPatterns) {
      const matches = normalized.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !profile.keywords.includes(match[1])) {
          profile.keywords.push(match[1]);
          if (profile.keywords.length > 10) {
            profile.keywords = profile.keywords.slice(-10);
          }
        }
      }
    }

    profile.interactionCount += 1;
    await this.saveProfile(profile);

    return profile;
  }

  /**
   * Mark properties as disliked (user said "không phù hợp", "không thích", etc.)
   */
  async markDisliked(sessionId: string, propertyIds: number[]): Promise<void> {
    const profile = await this.getProfile(sessionId);
    for (const id of propertyIds) {
      if (!profile.dislikedPropertyIds.includes(id)) {
        profile.dislikedPropertyIds.push(id);
        if (profile.dislikedPropertyIds.length > 30) {
          profile.dislikedPropertyIds = profile.dislikedPropertyIds.slice(-30);
        }
      }
    }
    await this.saveProfile(profile);
  }

  /**
   * Detect if user is expressing dislike for current results.
   */
  detectDislike(question: string): boolean {
    const normalized = AiUtils.normalizeText(question);
    return /\b(khong phu hop|khong thich|khong can|khong muon|khong ok|khong duoc|khong hay|khong tot|bo qua|thoi|next|skip)\b/.test(normalized);
  }

  /**
   * Build a personalized greeting/context string based on profile.
   */
  buildProfileContext(profile: UserProfile): string {
    if (profile.interactionCount === 0) return '';

    const parts: string[] = [];

    if (profile.budgetMax) {
      parts.push(`Ngân sách: dưới ${AiUtils.formatVnd(profile.budgetMax)}`);
    }
    if (profile.preferredAreas.length > 0) {
      parts.push(`Khu vực quan tâm: ${profile.preferredAreas.slice(-3).join(', ')}`);
    }
    if (profile.propertyType) {
      parts.push(`Loại BĐS: ${profile.propertyType === 'house' ? 'nhà' : 'đất'}`);
    }
    if (profile.purpose) {
      const purposeMap = { invest: 'đầu tư', live: 'để ở', rent_out: 'cho thuê lại' };
      parts.push(`Mục đích: ${purposeMap[profile.purpose]}`);
    }
    if (profile.keywords.length > 0) {
      parts.push(`Tiêu chí: ${profile.keywords.slice(-5).join(', ')}`);
    }

    if (parts.length === 0) return '';

    return `[HỒ SƠ KHÁCH HÀNG] ${parts.join(' | ')} | Đã xem ${profile.viewedPropertyIds.length} BĐS`;
  }

  /**
   * Filter out previously viewed/disliked properties from results.
   */
  filterSeenProperties<T extends { payload: Record<string, unknown> }>(
    hits: T[],
    profile: UserProfile,
    excludeDisliked = true,
  ): T[] {
    const dislikedSet = new Set(excludeDisliked ? profile.dislikedPropertyIds : []);

    return hits.filter((h) => {
      const sourceId = Number(h.payload?.sourceId ?? 0);
      if (!Number.isFinite(sourceId) || sourceId <= 0) return true;
      return !dislikedSet.has(sourceId);
    });
  }

  private createEmptyProfile(sessionId: string): UserProfile {
    return {
      sessionId,
      preferredAreas: [],
      preferredDistricts: [],
      viewedPropertyIds: [],
      dislikedPropertyIds: [],
      interactionCount: 0,
      lastActiveAt: new Date().toISOString(),
      keywords: [],
    };
  }
}
