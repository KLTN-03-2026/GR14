import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { MarketInsight } from '../types/ai.types';
import { AiUtils } from '../utils/ai.utils';

/**
 * Provides real-time market insights, investment advice, and trend analysis
 * by aggregating data from the property database.
 */
@Injectable()
export class MarketInsightService {
  private readonly logger = new Logger(MarketInsightService.name);
  private readonly cacheTtlSec = Number(
    process.env.MARKET_INSIGHT_CACHE_TTL || 3600,
  ); // 1 hour
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly geminiChatModel =
    process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
  private readonly geminiApiBase =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta';
  private readonly geminiTimeoutMs = Number(
    process.env.GEMINI_TIMEOUT_MS || 15000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get market insight for a specific area.
   */
  async getMarketInsight(
    area?: string,
    propertyType?: 'house' | 'land',
  ): Promise<MarketInsight | null> {
    const cacheKey = `ai:market:${AiUtils.normalizeText(area || 'all')}:${propertyType || 'all'}`;
    const cached = await this.redis.get<MarketInsight>(cacheKey);
    if (cached) return cached;

    const insight = await this.computeMarketInsight(area, propertyType);
    if (insight) {
      await this.redis.set(cacheKey, insight, this.cacheTtlSec);
    }
    return insight;
  }

  /**
   * Build a comprehensive market analysis answer.
   */
  async buildMarketAnalysisAnswer(
    question: string,
    area?: string,
    propertyType?: 'house' | 'land',
  ): Promise<string> {
    const insight = await this.getMarketInsight(area, propertyType);

    if (!insight || insight.totalListings === 0) {
      return this.buildNoDataAnswer(area, propertyType);
    }

    const typeLabel =
      propertyType === 'land'
        ? 'đất'
        : propertyType === 'house'
          ? 'nhà'
          : 'bất động sản';
    const areaLabel = area || 'tất cả khu vực';

    const lines: string[] = [];
    lines.push(`📊 **Phân tích thị trường ${typeLabel} tại ${areaLabel}:**`);
    lines.push('');
    lines.push(`📈 **Tổng quan:**`);
    lines.push(`- Tổng số tin đăng: **${insight.totalListings}** tin`);
    lines.push(`- Giá trung bình: **${AiUtils.formatVnd(insight.avgPrice)}**`);
    lines.push(`- Giá thấp nhất: **${AiUtils.formatVnd(insight.minPrice)}**`);
    lines.push(`- Giá cao nhất: **${AiUtils.formatVnd(insight.maxPrice)}**`);
    if (insight.avgPricePerM2 > 0) {
      lines.push(
        `- Giá trung bình/m²: **${AiUtils.formatVnd(insight.avgPricePerM2)}/m²**`,
      );
    }

    if (insight.priceBreakdown.length > 0) {
      lines.push('');
      lines.push('💰 **Phân bố giá:**');
      for (const segment of insight.priceBreakdown) {
        const pct =
          insight.totalListings > 0
            ? ((segment.count / insight.totalListings) * 100).toFixed(0)
            : '0';
        lines.push(`- ${segment.range}: ${segment.count} tin (${pct}%)`);
      }
    }

    // Add AI-powered trend analysis
    const aiAnalysis = await this.getAIMarketAnalysis(
      question,
      insight,
      areaLabel,
      typeLabel,
    );
    if (aiAnalysis) {
      lines.push('');
      lines.push(aiAnalysis);
    }

    lines.push('');
    lines.push(
      '_Dữ liệu được tổng hợp từ hệ thống BĐS Real Estate. Giá có thể thay đổi theo thời điểm._',
    );

    return lines.join('\n');
  }

  /**
   * Build investment advice based on market data and user criteria.
   */
  async buildInvestmentAdvice(
    question: string,
    area?: string,
    budget?: number,
    propertyType?: 'house' | 'land',
  ): Promise<string> {
    const insight = await this.getMarketInsight(area, propertyType);

    // Use Gemini for intelligent investment advice
    if (this.geminiApiKey) {
      const contextData = insight
        ? `Dữ liệu thị trường ${area || 'tổng quát'}: Giá TB ${AiUtils.formatVnd(insight.avgPrice)}, ${insight.totalListings} tin đăng, giá/m² ${AiUtils.formatVnd(insight.avgPricePerM2)}.`
        : 'Không có dữ liệu thị trường cụ thể.';

      const prompt = [
        'Bạn là chuyên gia tư vấn đầu tư bất động sản Việt Nam.',
        '',
        `Câu hỏi: ${question}`,
        '',
        contextData,
        budget ? `Ngân sách: ${AiUtils.formatVnd(budget)}` : '',
        area ? `Khu vực: ${area}` : '',
        propertyType
          ? `Loại BĐS: ${propertyType === 'house' ? 'nhà' : 'đất'}`
          : '',
        '',
        'Yêu cầu:',
        '1. Phân tích tiềm năng đầu tư khu vực dựa trên dữ liệu',
        '2. Đề xuất chiến lược đầu tư phù hợp (mua bán/cho thuê/giữ dài hạn)',
        '3. Ước tính ROI tiềm năng nếu có dữ liệu',
        '4. Cảnh báo rủi ro cần lưu ý',
        '5. Trả lời bằng tiếng Việt có dấu, dưới 300 từ',
        '6. Dùng gạch đầu dòng và in đậm cho đẹp',
      ]
        .filter(Boolean)
        .join('\n');

      const text = await AiUtils.generateLlmResponse(
        prompt,
        'Bạn là chuyên gia tư vấn đầu tư BĐS Việt Nam. Trả lời chuyên nghiệp, dùng tiếng Việt có dấu.',
        {
          temperature: 0.4,
          maxTokens: 1200,
          timeout: Math.max(this.geminiTimeoutMs, 25000),
        },
      );

      this.logger.log(`[INVESTMENT] LLM response length: ${text?.length || 0}`);
      if (text && text.length > 50) {
        return `🏦 **Tư vấn đầu tư BĐS:**\n\n${text}`;
      }
    }

    // Fallback: rule-based advice
    return this.buildRuleBasedInvestmentAdvice(
      area,
      budget,
      propertyType,
      insight,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private async computeMarketInsight(
    area?: string,
    propertyType?: 'house' | 'land',
  ): Promise<MarketInsight | null> {
    try {
      const locationFilter = area ? this.buildLocationFilter(area) : {};

      const [houses, lands] = await Promise.all([
        propertyType !== 'land'
          ? this.prisma.house.findMany({
              where: { status: 1, ...locationFilter },
              select: { price: true, area: true, district: true, city: true },
            })
          : Promise.resolve([]),
        propertyType !== 'house'
          ? this.prisma.land.findMany({
              where: { status: 1, ...locationFilter },
              select: { price: true, area: true, district: true, city: true },
            })
          : Promise.resolve([]),
      ]);

      const allPrices: number[] = [];
      const allPricePerM2: number[] = [];

      // Sale price floor: 100 triệu — filter out rental prices (e.g. 2.8 triệu/tháng)
      const SALE_PRICE_FLOOR = 100_000_000;

      for (const item of [...houses, ...lands]) {
        const price = Number(item.price || 0);
        const itemArea = Number(item.area || 0);
        if (price >= SALE_PRICE_FLOOR) {
          allPrices.push(price);
          if (itemArea > 0) {
            allPricePerM2.push(price / itemArea);
          }
        }
      }

      if (allPrices.length === 0) return null;

      allPrices.sort((a, b) => a - b);

      const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
      const avgPricePerM2 =
        allPricePerM2.length > 0
          ? allPricePerM2.reduce((a, b) => a + b, 0) / allPricePerM2.length
          : 0;

      // Build price breakdown segments
      const breakdowns = [
        { range: 'Dưới 1 tỷ', min: 0, max: 1_000_000_000 },
        { range: '1–3 tỷ', min: 1_000_000_000, max: 3_000_000_000 },
        { range: '3–5 tỷ', min: 3_000_000_000, max: 5_000_000_000 },
        { range: '5–10 tỷ', min: 5_000_000_000, max: 10_000_000_000 },
        { range: 'Trên 10 tỷ', min: 10_000_000_000, max: Infinity },
      ];

      const priceBreakdown = breakdowns
        .map((b) => ({
          range: b.range,
          count: allPrices.filter((p) => p >= b.min && p < b.max).length,
        }))
        .filter((b) => b.count > 0);

      return {
        area: area || 'Tất cả',
        avgPrice: Math.round(avgPrice),
        minPrice: allPrices[0],
        maxPrice: allPrices[allPrices.length - 1],
        totalListings: allPrices.length,
        avgPricePerM2: Math.round(avgPricePerM2),
        priceBreakdown,
      };
    } catch (error) {
      this.logger.warn(
        `computeMarketInsight failed: ${AiUtils.stringifyError(error)}`,
      );
      return null;
    }
  }

  private buildLocationFilter(area: string): Record<string, unknown> {
    const normalized = AiUtils.normalizeText(area);

    // Vietnamese city/district name map (normalized → original with diacritics)
    const VIET_NAMES: Record<string, string> = {
      'da nang': 'Đà Nẵng',
      'ha noi': 'Hà Nội',
      'ho chi minh': 'Hồ Chí Minh',
      hcm: 'Hồ Chí Minh',
      'can tho': 'Cần Thơ',
      'hai phong': 'Hải Phòng',
      'binh duong': 'Bình Dương',
      'dong nai': 'Đồng Nai',
      'khanh hoa': 'Khánh Hòa',
      'nha trang': 'Nha Trang',
      hue: 'Huế',
      'vung tau': 'Vũng Tàu',
      'phu quoc': 'Phú Quốc',
      'quang nam': 'Quảng Nam',
      'hai chau': 'Hải Châu',
      'lien chieu': 'Liên Chiểu',
      'son tra': 'Sơn Trà',
      'ngu hanh son': 'Ngũ Hành Sơn',
      'thanh khe': 'Thanh Khê',
      'cam le': 'Cẩm Lệ',
      'hoa vang': 'Hoà Vang',
      'tay ninh': 'Tây Ninh',
      'lam dong': 'Lâm Đồng',
    };

    const OR: Record<string, unknown>[] = [];

    // Resolve to diacritics name
    const displayName = VIET_NAMES[normalized.trim()] || area.trim();

    // DB stores "TP Đà Nẵng", "TP Hà Nội", etc. — add both "TP X" and "X" variants
    const searchVariants = [
      displayName, // e.g. "Đà Nẵng"
      `TP ${displayName}`, // e.g. "TP Đà Nẵng"
      `Thành phố ${displayName}`, // e.g. "Thành phố Đà Nẵng"
    ];

    for (const variant of searchVariants) {
      OR.push(
        { city: { contains: variant } },
        { district: { contains: variant } },
      );
    }

    // Also try individual tokens for district matching (e.g. "Hải Châu")
    const tokens = normalized.split(/\s+/).filter((t) => t.length >= 3);
    for (const token of tokens) {
      const mapped = VIET_NAMES[token];
      if (mapped) {
        OR.push(
          { city: { contains: mapped } },
          { district: { contains: mapped } },
        );
      }
    }

    return OR.length > 0 ? { OR } : {};
  }

  private async getAIMarketAnalysis(
    question: string,
    insight: MarketInsight,
    areaLabel: string,
    typeLabel: string,
  ): Promise<string | null> {
    if (!this.geminiApiKey) return null;

    try {
      const dataStr = [
        `Khu vực: ${areaLabel}`,
        `Loại: ${typeLabel}`,
        `Tổng tin: ${insight.totalListings}`,
        `Giá TB: ${AiUtils.formatVnd(insight.avgPrice)}`,
        `Giá min: ${AiUtils.formatVnd(insight.minPrice)}`,
        `Giá max: ${AiUtils.formatVnd(insight.maxPrice)}`,
        `Giá TB/m²: ${AiUtils.formatVnd(insight.avgPricePerM2)}`,
        `Phân bố: ${insight.priceBreakdown.map((b) => `${b.range}: ${b.count}`).join(', ')}`,
      ].join('\n');

      const prompt = [
        `Dữ liệu thị trường BĐS:\n${dataStr}`,
        '',
        `Câu hỏi: ${question}`,
        '',
        'Phân tích ngắn gọn (80-120 từ) về:',
        '1. Nhận xét về mức giá và phân khúc phổ biến',
        '2. Đánh giá tiềm năng khu vực',
        '3. Lời khuyên cho người mua/đầu tư',
        'Dùng tiếng Việt có dấu, gạch đầu dòng.',
      ].join('\n');

      const text = await AiUtils.generateLlmResponse(
        prompt,
        'Bạn là chuyên gia phân tích thị trường BĐS Việt Nam. Trả lời ngắn gọn, chuyên nghiệp.',
        { temperature: 0.3, maxTokens: 1200, timeout: Math.max(this.geminiTimeoutMs, 25000) },
      );

      return text && text.length > 30 ? `🤖 **Nhận định AI:**\n${text}` : null;
    } catch (error) {
      this.logger.warn(
        `AI market analysis failed: ${AiUtils.stringifyError(error)}`,
      );
      return null;
    }
  }

  private buildRuleBasedInvestmentAdvice(
    area?: string,
    budget?: number,
    propertyType?: 'house' | 'land',
    insight?: MarketInsight | null,
  ): string {
    const lines: string[] = [];
    lines.push('🏦 **Tư vấn đầu tư BĐS:**');
    lines.push('');

    if (budget) {
      lines.push(`💰 **Ngân sách:** ${AiUtils.formatVnd(budget)}`);
      lines.push('');
    }

    if (insight && insight.totalListings > 0) {
      const avgPrice = insight.avgPrice;
      if (budget && budget < avgPrice * 0.7) {
        lines.push(
          `⚠️ Ngân sách thấp hơn giá trung bình khu vực (${AiUtils.formatVnd(avgPrice)}). Nên xem xét:`,
        );
        lines.push('- Khu vực lân cận giá mềm hơn');
        lines.push('- Đất nền thay vì nhà hoàn thiện');
        lines.push('- Mua và giữ lâu dài để tăng giá');
      } else {
        lines.push('✅ Ngân sách phù hợp với mặt bằng giá khu vực.');
      }
      lines.push('');
    }

    lines.push('📋 **Nguyên tắc đầu tư an toàn:**');
    lines.push('- Kiểm tra pháp lý kỹ (sổ hồng, quy hoạch)');
    lines.push('- Không dùng quá 50% vốn vay');
    lines.push(
      '- Ưu tiên vị trí gần hạ tầng (đường lớn, trường học, bệnh viện)',
    );
    lines.push('- Xem xét thanh khoản khu vực (dễ bán lại)');

    if (propertyType === 'land') {
      lines.push('');
      lines.push('🌱 **Đầu tư đất nền:**');
      lines.push('- Lợi nhuận kỳ vọng: 15-30%/năm');
      lines.push('- Rủi ro: pháp lý, quy hoạch, thanh khoản');
      lines.push('- Phù hợp: vốn nhỏ, giữ dài hạn 3-5 năm');
    } else if (propertyType === 'house') {
      lines.push('');
      lines.push('🏠 **Đầu tư nhà:**');
      lines.push('- Cho thuê: lợi nhuận 4-7%/năm (ổn định)');
      lines.push('- Bán lại: phụ thuộc vị trí và thị trường');
      lines.push('- Phù hợp: vốn lớn, muốn thu nhập thụ động');
    }

    return lines.join('\n');
  }

  private buildNoDataAnswer(
    area?: string,
    propertyType?: 'house' | 'land',
  ): string {
    const typeLabel =
      propertyType === 'land'
        ? 'đất'
        : propertyType === 'house'
          ? 'nhà'
          : 'bất động sản';
    const areaLabel = area || 'khu vực này';
    return [
      `📊 Hiện tại chưa có đủ dữ liệu thị trường ${typeLabel} tại **${areaLabel}** để phân tích.`,
      '',
      'Bạn có thể:',
      '- Thử tìm kiếm khu vực khác gần đó',
      '- Hỏi về thị trường tổng quát',
      '- Tìm BĐS cụ thể tại khu vực mong muốn',
    ].join('\n');
  }
}
