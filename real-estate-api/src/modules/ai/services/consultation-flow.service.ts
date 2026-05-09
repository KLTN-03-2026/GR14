import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { ConsultationState, ConsultationStep, ParsedIntent, UserProfile } from '../types/ai.types';
import { AiUtils } from '../utils/ai.utils';

/**
 * Manages multi-step consultation workflow.
 * Guides users through a structured process to find the perfect property.
 */
@Injectable()
export class ConsultationFlowService {
  private readonly logger = new Logger(ConsultationFlowService.name);
  private readonly consultationTtlSec = Number(process.env.CONSULTATION_TTL || 3600); // 1 hour

  constructor(private readonly redis: RedisService) {}

  private consultationKey(sessionId: string): string {
    return `ai:consultation:${sessionId}`;
  }

  async getState(sessionId: string): Promise<ConsultationState | null> {
    return this.redis.get<ConsultationState>(this.consultationKey(sessionId));
  }

  async saveState(sessionId: string, state: ConsultationState): Promise<void> {
    await this.redis.set(this.consultationKey(sessionId), state, this.consultationTtlSec);
  }

  async clearState(sessionId: string): Promise<void> {
    await this.redis.set(this.consultationKey(sessionId), null, 1);
  }

  /**
   * Determine if user wants to start a consultation session.
   */
  isConsultationTrigger(question: string): boolean {
    const normalized = AiUtils.normalizeText(question);
    // Only match explicit consultation requests — avoid broad patterns like
    // "tu van" (matches "tư vấn đầu tư") or "nen dau tu" (matches "đất nền đầu tư")
    return /\b(tu van cho minh|giup minh chon|huong dan mua|nen mua gi|mua nha nao|giup minh tim|ban tu van|muon duoc tu van|can tu van)\b/.test(normalized);
  }

  /**
   * Start a new consultation session.
   */
  async startConsultation(sessionId: string, profile: UserProfile): Promise<string> {
    // Pre-fill from profile if available
    const state: ConsultationState = {
      step: 'ask_purpose',
      purpose: profile.purpose,
      budgetMin: profile.budgetMin,
      budgetMax: profile.budgetMax,
      location: profile.preferredAreas.length > 0 ? profile.preferredAreas[profile.preferredAreas.length - 1] : undefined,
      propertyType: profile.propertyType,
      startedAt: new Date().toISOString(),
    };

    // Skip steps we already know from profile
    if (state.purpose) {
      state.step = 'ask_budget';
    }
    if (state.purpose && state.budgetMax) {
      state.step = 'ask_location';
    }
    if (state.purpose && state.budgetMax && state.location) {
      state.step = 'ask_property_type';
    }
    if (state.purpose && state.budgetMax && state.location && state.propertyType) {
      state.step = 'ask_criteria';
    }

    await this.saveState(sessionId, state);
    return this.buildStepQuestion(state, profile);
  }

  /**
   * Process user answer and advance to next step.
   */
  async processAnswer(
    sessionId: string,
    question: string,
    currentState: ConsultationState,
  ): Promise<{ answer: string; state: ConsultationState; completed: boolean; intent?: ParsedIntent }> {
    const normalized = AiUtils.normalizeText(question);

    // Allow user to cancel
    if (/\b(huy|cancel|dung lai|thoi|khong can|bo)\b/.test(normalized)) {
      await this.clearState(sessionId);
      return {
        answer: 'Đã dừng quy trình tư vấn. Bạn có thể hỏi mình bất cứ điều gì khác!',
        state: { ...currentState, step: 'idle' },
        completed: false,
      };
    }

    const updatedState = { ...currentState };

    switch (currentState.step) {
      case 'ask_purpose':
        updatedState.purpose = this.extractPurpose(normalized);
        updatedState.step = 'ask_budget';
        break;

      case 'ask_budget':
        const budgetInfo = this.extractBudget(normalized);
        if (budgetInfo.max) updatedState.budgetMax = budgetInfo.max;
        if (budgetInfo.min) updatedState.budgetMin = budgetInfo.min;
        updatedState.step = 'ask_location';
        break;

      case 'ask_location':
        updatedState.location = this.extractLocation(question);
        updatedState.step = 'ask_property_type';
        break;

      case 'ask_property_type':
        updatedState.propertyType = this.extractPropertyType(normalized);
        updatedState.step = 'ask_criteria';
        break;

      case 'ask_criteria':
        updatedState.additionalCriteria = question.trim();
        const bedroomMatch = normalized.match(/(\d+)\s*(phong ngu|pn|phong)/);
        if (bedroomMatch) updatedState.bedrooms = Number(bedroomMatch[1]);
        updatedState.step = 'recommend';
        break;

      default:
        break;
    }

    await this.saveState(sessionId, updatedState);

    if (updatedState.step === 'recommend') {
      // Build a search intent from consultation data
      const searchIntent: ParsedIntent = {
        type: 'search_property',
        minPrice: updatedState.budgetMin,
        maxPrice: updatedState.budgetMax,
        location: updatedState.location,
        sourceType: updatedState.propertyType,
        purpose: updatedState.purpose,
      };

      const summary = this.buildConsultationSummary(updatedState);
      await this.clearState(sessionId);

      return {
        answer: summary,
        state: { ...updatedState, step: 'completed' },
        completed: true,
        intent: searchIntent,
      };
    }

    return {
      answer: this.buildStepQuestion(updatedState),
      state: updatedState,
      completed: false,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private buildStepQuestion(state: ConsultationState, profile?: UserProfile): string {
    const greeting = profile && profile.interactionCount > 0
      ? 'Tiếp tục tư vấn cho bạn nhé!'
      : '🏡 **Chào mừng bạn đến với dịch vụ tư vấn BĐS!**\n\nMình sẽ hướng dẫn bạn từng bước để tìm BĐS phù hợp nhất.';

    switch (state.step) {
      case 'ask_purpose':
        return [
          greeting,
          '',
          '**Bước 1/5 - Mục đích:**',
          'Bạn muốn tìm BĐS với mục đích gì?',
          '',
          '1️⃣ **Để ở** - Mua nhà/đất để ở lâu dài',
          '2️⃣ **Đầu tư** - Mua để tăng giá bán lại',
          '3️⃣ **Cho thuê** - Mua để cho thuê thu nhập thụ động',
          '',
          '_Nhập số (1/2/3) hoặc mô tả mục đích của bạn._',
        ].join('\n');

      case 'ask_budget':
        return [
          '💰 **Bước 2/5 - Ngân sách:**',
          '',
          'Ngân sách dự kiến của bạn là bao nhiêu?',
          '',
          'Ví dụ: "2 tỷ", "từ 1 đến 3 tỷ", "dưới 5 tỷ"',
          '',
          state.purpose === 'invest'
            ? '_💡 Tip: Đầu tư nên dành ít nhất 30% vốn tự có, phần còn lại vay ngân hàng._'
            : '_💡 Tip: Ngoài giá BĐS, nên dự trù thêm 5-10% cho phí phát sinh (thuế, công chứng...)._',
        ].join('\n');

      case 'ask_location':
        return [
          '📍 **Bước 3/5 - Khu vực:**',
          '',
          'Bạn muốn tìm ở khu vực nào?',
          '',
          'Ví dụ: "Đà Nẵng", "quận Hải Châu", "Bình Dương"',
          '',
          state.purpose === 'invest'
            ? '_💡 Tip: Đầu tư nên chú ý khu vực có quy hoạch hạ tầng mới (cầu, đường cao tốc, KCN)._'
            : '_💡 Tip: Chọn khu vực gần trường học, bệnh viện, chợ để thuận tiện sinh hoạt._',
        ].join('\n');

      case 'ask_property_type':
        return [
          '🏠 **Bước 4/5 - Loại BĐS:**',
          '',
          'Bạn quan tâm loại BĐS nào?',
          '',
          '1️⃣ **Nhà** - Nhà phố, biệt thự, căn hộ',
          '2️⃣ **Đất** - Đất nền, đất thổ cư',
          '',
          '_Nhập số (1/2) hoặc mô tả loại BĐS bạn muốn._',
        ].join('\n');

      case 'ask_criteria':
        return [
          '✨ **Bước 5/5 - Tiêu chí đặc biệt:**',
          '',
          'Bạn có yêu cầu đặc biệt nào không?',
          '',
          'Ví dụ:',
          '- Số phòng ngủ: "3 phòng ngủ"',
          '- Mặt tiền, hẻm xe hơi',
          '- Gần trường học, bệnh viện',
          '- Hướng Đông, có sân vườn',
          '- Hoặc "không có" nếu không yêu cầu đặc biệt',
        ].join('\n');

      default:
        return 'Bạn cần hỗ trợ gì thêm?';
    }
  }

  private buildConsultationSummary(state: ConsultationState): string {
    const purposeMap = { invest: 'đầu tư', live: 'để ở', rent_out: 'cho thuê lại' };
    const typeMap = { house: 'Nhà', land: 'Đất' };

    const lines: string[] = [];
    lines.push('✅ **Tổng kết nhu cầu tư vấn:**');
    lines.push('');
    if (state.purpose) lines.push(`🎯 Mục đích: **${purposeMap[state.purpose] || state.purpose}**`);
    if (state.budgetMax) {
      const budgetStr = state.budgetMin
        ? `${AiUtils.formatVnd(state.budgetMin)} – ${AiUtils.formatVnd(state.budgetMax)}`
        : `Dưới ${AiUtils.formatVnd(state.budgetMax)}`;
      lines.push(`💰 Ngân sách: **${budgetStr}**`);
    }
    if (state.location) lines.push(`📍 Khu vực: **${state.location}**`);
    if (state.propertyType) lines.push(`🏠 Loại BĐS: **${typeMap[state.propertyType] || state.propertyType}**`);
    if (state.bedrooms) lines.push(`🛏️ Phòng ngủ: **${state.bedrooms} phòng**`);
    if (state.additionalCriteria && state.additionalCriteria !== 'khong co') {
      lines.push(`✨ Yêu cầu thêm: ${state.additionalCriteria}`);
    }
    lines.push('');
    lines.push('🔍 Mình đang tìm BĐS phù hợp cho bạn...');

    return lines.join('\n');
  }

  private extractPurpose(normalized: string): 'invest' | 'live' | 'rent_out' {
    if (/\b(dau tu|sinh loi|loi nhuan|mua ban|tang gia|2)\b/.test(normalized)) return 'invest';
    if (/\b(cho thue|thue lai|thu nhap thu dong|3)\b/.test(normalized)) return 'rent_out';
    return 'live'; // default
  }

  private extractBudget(normalized: string): { min?: number; max?: number } {
    const rangeMatch = normalized.match(
      /tu\s+([0-9.,]+)\s*(ty|trieu|tr)?\s+(den|toi|-)\s+([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (rangeMatch) {
      const min = AiUtils.toVnd(rangeMatch[1], rangeMatch[2]);
      const max = AiUtils.toVnd(rangeMatch[4], rangeMatch[5]);
      if (min !== undefined && max !== undefined) {
        return { min: Math.min(min, max), max: Math.max(min, max) };
      }
    }

    const underMatch = normalized.match(/(duoi|nho hon|<|<=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/);
    if (underMatch) {
      const max = AiUtils.toVnd(underMatch[2], underMatch[3]);
      if (max !== undefined) return { max };
    }

    const bareMatch = normalized.match(/([0-9.,]+)\s*(ty|trieu|tr)/);
    if (bareMatch) {
      const amount = AiUtils.toVnd(bareMatch[1], bareMatch[2]);
      if (amount !== undefined) return { max: amount };
    }

    return {};
  }

  private extractLocation(question: string): string {
    const normalized = AiUtils.normalizeText(question);

    // Strip common Vietnamese prefixes so we get just the location name
    const stripped = normalized
      .replace(
        /^(minh muon tim o|minh muon o|muon tim o|muon o|o|tai|khu vuc|vung|thanh pho|tp)\s+/,
        '',
      )
      .trim();

    // Try to match a known location from the stripped text
    const KNOWN_LOCATIONS: Record<string, string> = {
      'da nang': 'Đà Nẵng', 'ha noi': 'Hà Nội', 'ho chi minh': 'Hồ Chí Minh',
      'binh duong': 'Bình Dương', 'dong nai': 'Đồng Nai', 'can tho': 'Cần Thơ',
      'hai phong': 'Hải Phòng', 'nha trang': 'Nha Trang', 'hue': 'Huế',
      'vung tau': 'Vũng Tàu', 'quang nam': 'Quảng Nam', 'binh dinh': 'Bình Định',
      'khanh hoa': 'Khánh Hòa', 'da lat': 'Đà Lạt', 'lam dong': 'Lâm Đồng',
      'hai chau': 'Hải Châu', 'lien chieu': 'Liên Chiểu', 'son tra': 'Sơn Trà',
      'ngu hanh son': 'Ngũ Hành Sơn', 'thanh khe': 'Thanh Khê', 'cam le': 'Cẩm Lệ',
      'hoa vang': 'Hoà Vang', 'binh thanh': 'Bình Thạnh', 'tan binh': 'Tân Bình',
      'thu duc': 'Thủ Đức', 'go vap': 'Gò Vấp', 'phu nhuan': 'Phú Nhuận',
      'tan phu': 'Tân Phú', 'binh tan': 'Bình Tân',
    };

    // Check longest match first (e.g. "ngu hanh son" before "son")
    const sortedKeys = Object.keys(KNOWN_LOCATIONS).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (stripped.includes(key) || normalized.includes(key)) {
        return KNOWN_LOCATIONS[key];
      }
    }

    // Fallback: return original question trimmed (preserving diacritics)
    return question.trim();
  }

  private extractPropertyType(normalized: string): 'house' | 'land' {
    if (/\b(dat|dat nen|tho cu|2)\b/.test(normalized)) return 'land';
    return 'house'; // default
  }
}
