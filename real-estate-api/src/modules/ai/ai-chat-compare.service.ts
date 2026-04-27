import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

type ChatSourcePayload = Record<string, unknown>;

@Injectable()
export class AiChatCompareService {
  private readonly logger = new Logger(AiChatCompareService.name);
  private readonly frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:3000';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scan recent assistant turns in memory and extract property IDs.
   * Looks for patterns like "ID 123", "(ID 456)", "/houses/789", "/lands/321",
   * and "sourceId":123 produced by compare/search answer templates.
   */
  extractIdsFromHistory(memory: ChatTurn[]): number[] {
    const assistantTurns = memory
      .filter((t) => t.role === 'assistant')
      .slice(-6);

    const seen = new Set<number>();
    const ids: number[] = [];

    for (const turn of assistantTurns) {
      const text = turn.text;

      const idPatterns = [...text.matchAll(/\bID\s*[:\s#]?\s*(\d+)\b/gi)];
      const urlPatterns = [
        ...text.matchAll(/\/(?:houses|lands|nha|dat)\/(\d+)/gi),
      ];
      const sourceIdPatterns = [...text.matchAll(/"sourceId"\s*:\s*(\d+)/g)];

      for (const match of [
        ...idPatterns,
        ...urlPatterns,
        ...sourceIdPatterns,
      ]) {
        const id = Number(match[1]);
        if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }

    return ids;
  }

  /**
   * Find the sourceId of a property matching a free-text description.
   */
  async findIdByDescription(
    description: string,
    excludeId?: number,
  ): Promise<number | null> {
    const stopWords = new Set([
      'nha',
      'dat',
      'can',
      'tin',
      'ban',
      'cho',
      'thue',
      'mua',
      'o',
      'tai',
      'voi',
      'va',
      'de',
      'la',
      'duong',
      'phuong',
      'quan',
      'tp',
      'thanh',
      'pho',
      'thi',
      'xa',
      'huyen',
      'so',
      'mat',
      'tien',
      'hem',
      'ngo',
      'biet',
      'thu',
      'can',
      'ho',
      'chung',
      'cu',
    ]);
    const descNorm = this.normalizeText(description);
    const descTokens = descNorm
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopWords.has(t))
      .slice(0, 8);

    if (descTokens.length === 0) return null;

    return this.findByTextInDb(description, excludeId, descTokens);
  }

  /**
   * Fallback property lookup: tokenise the free-text description and count keyword
   * matches against title + address fields of every active house/land record.
   */
  async findByTextInDb(
    description: string,
    excludeId?: number,
    precomputedTokens?: string[],
  ): Promise<number | null> {
    let tokens: string[];

    if (precomputedTokens && precomputedTokens.length > 0) {
      tokens = precomputedTokens;
    } else {
      const normalized = this.normalizeText(description);
      const stopWords = new Set([
        'nha',
        'dat',
        'can',
        'tin',
        'ban',
        'cho',
        'thue',
        'mua',
        'o',
        'tai',
        'voi',
        'va',
        'de',
        'la',
        'duong',
        'phuong',
        'quan',
        'tp',
        'thanh',
        'pho',
        'thi',
        'xa',
        'huyen',
        'so',
        'mat',
        'tien',
        'hem',
        'ngo',
      ]);
      tokens = normalized
        .split(/\s+/)
        .filter((t) => t.length >= 2 && !stopWords.has(t))
        .slice(0, 8);
    }

    if (tokens.length === 0) return null;

    // Build bigrams from query tokens for multi-word phrase matching
    const bigrams =
      tokens.length >= 2
        ? tokens.slice(0, -1).map((t, i) => `${t} ${tokens[i + 1]}`)
        : [];

    const selectFields = {
      id: true,
      title: true,
      street: true,
      ward: true,
      district: true,
      city: true,
    } as const;

    const scoreRecord = (r: {
      id: number;
      title?: string | null;
      street?: string | null;
      ward?: string | null;
      district?: string | null;
      city?: string | null;
    }): number => {
      if (excludeId !== undefined && r.id === excludeId) return -1;

      const titleNorm = this.normalizeText(r.title || '');
      const addressNorm = this.normalizeText(
        [r.street, r.ward, r.district, r.city].filter(Boolean).join(' '),
      );
      const fullNorm = `${titleNorm} ${addressNorm}`;

      const titleWords = new Set(
        titleNorm.split(/\s+/).filter((w) => w.length > 0),
      );
      const allWords = new Set(
        fullNorm.split(/\s+/).filter((w) => w.length > 0),
      );

      // Unigram score: title matches count double (more specific signal)
      let score = 0;
      for (const t of tokens) {
        if (titleWords.has(t)) score += 2;
        else if (allWords.has(t)) score += 1;
      }

      // Bigram score: phrase matches in full text score +3 each
      for (const bg of bigrams) {
        if (fullNorm.includes(bg)) score += 3;
      }

      return score;
    };

    const getBestMatch = (
      houses: Array<{
        id: number;
        title: string | null;
        street: string | null;
        ward: string | null;
        district: string | null;
        city: string | null;
      }>,
      lands: Array<{
        id: number;
        title: string | null;
        street: string | null;
        ward: string | null;
        district: string | null;
        city: string | null;
      }>,
    ): { bestId: number | null; bestScore: number } => {
      let bestId: number | null = null;
      let bestScore = 0;

      for (const h of houses) {
        const s = scoreRecord(h);
        if (s > bestScore) {
          bestScore = s;
          bestId = h.id;
        }
      }
      for (const l of lands) {
        const s = scoreRecord(l);
        if (s > bestScore) {
          bestScore = s;
          bestId = l.id;
        }
      }

      return { bestId, bestScore };
    };

    try {
      const tokenOrFilters = tokens.flatMap((token) => [
        { title: { contains: token } },
        { street: { contains: token } },
        { ward: { contains: token } },
        { district: { contains: token } },
        { city: { contains: token } },
      ]);

      // Phase 1: targeted query for likely matches (fast path)
      const [targetedHouses, targetedLands] = await Promise.all([
        this.prisma.house.findMany({
          where: {
            status: 1,
            OR: tokenOrFilters as never[],
          },
          orderBy: { updatedAt: 'desc' },
          take: 250,
          select: selectFields,
        }),
        this.prisma.land.findMany({
          where: {
            status: 1,
            OR: tokenOrFilters as never[],
          },
          orderBy: { updatedAt: 'desc' },
          take: 250,
          select: selectFields,
        }),
      ]);

      const targetedBest = getBestMatch(targetedHouses, targetedLands);
      if (targetedBest.bestScore >= 2) {
        return targetedBest.bestId;
      }

      // Phase 2: broader fallback scan (still bounded)
      const [houses, lands] = await Promise.all([
        this.prisma.house.findMany({
          where: { status: 1 },
          orderBy: { updatedAt: 'desc' },
          take: 1200,
          select: selectFields,
        }),
        this.prisma.land.findMany({
          where: { status: 1 },
          orderBy: { updatedAt: 'desc' },
          take: 1200,
          select: selectFields,
        }),
      ]);

      const fallbackBest = getBestMatch(houses, lands);

      // Require a minimum score of 2 to avoid false positives on single weak token hits
      return fallbackBest.bestScore >= 2 ? fallbackBest.bestId : null;
    } catch (error) {
      this.logger.warn(
        `findByTextInDb failed for "${description}": ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  async buildCompareAnswer(ids: number[]): Promise<{
    answer: string;
    sources: ChatSourcePayload[];
    suggestedQuestions: string[];
  }> {
    const findById = async (id: number) => {
      const house = await this.prisma.house.findUnique({ where: { id } });
      if (house)
        return {
          type: 'house' as const,
          data: house as Record<string, unknown>,
        };
      const land = await this.prisma.land.findUnique({ where: { id } });
      if (land)
        return { type: 'land' as const, data: land as Record<string, unknown> };
      return null;
    };

    const results = await Promise.all(ids.map(findById));
    let found = results.filter((r): r is NonNullable<typeof r> => r !== null);

    // Prefer comparing same-type properties for meaningful results
    if (found.length >= 2) {
      const houses = found.filter((f) => f.type === 'house');
      const lands = found.filter((f) => f.type === 'land');
      // If we have mixed types AND at least 2 of the same type, use same-type only
      if (houses.length > 0 && lands.length > 0) {
        if (houses.length >= 2) {
          found = houses;
        } else if (lands.length >= 2) {
          found = lands;
        }
        // If only 1 of each type, keep both (user likely wants cross-type comparison)
      }
    }

    if (found.length < 2) {
      return {
        answer:
          'Mình chưa tìm thấy đủ bất động sản để so sánh. Bạn có thể mở lại 2 tin cần so sánh hoặc gửi link chi tiết của từng tin.',
        sources: [],
        suggestedQuestions: ['Tìm nhà dưới 5 tỷ', 'Tìm đất nền giá rẻ'],
      };
    }

    const sources: ChatSourcePayload[] = [];

    const propertyRows = found.map((item, idx) => {
      const d = item.data;
      const price = this.toNumber(d.price);
      const area = this.toNumber(d.area);
      const pricePerM2 = area > 0 ? Math.round(price / area) : 0;
      const url = `${this.frontendUrl}/${item.type === 'house' ? 'houses' : 'lands'}/${String(d.id)}`;
      const typeLabel = item.type === 'house' ? 'Nhà' : 'Đất';

      sources.push({
        source: item.type,
        sourceId: d.id,
        title: d.title,
        city: d.city,
        district: d.district,
        price,
        area,
        url,
      });

      return {
        idx: idx + 1,
        id: d.id,
        type: typeLabel,
        title: String(d.title || 'N/A'),
        location: `${String(d.street || '')} ${String(d.ward || '')} ${String(d.district || '')}, ${String(d.city || '')}`,
        price,
        priceFormatted: this.formatVnd(price),
        area,
        areaFormatted: this.formatArea(area),
        pricePerM2,
        pricePerM2Formatted: this.formatVnd(pricePerM2),
        url,
      };
    });

    const sorted = [...found].sort(
      (a, b) => this.toNumber(a.data.price) - this.toNumber(b.data.price),
    );
    const cheapest = sorted[0];
    const cheapestIdx = found.indexOf(cheapest) + 1;
    const cheapestPrice = this.toNumber(cheapest.data.price);

    const largest = found.reduce((best, cur) =>
      this.toNumber(cur.data.area) > this.toNumber(best.data.area) ? cur : best,
    );
    const largestIdx = found.indexOf(largest) + 1;
    const largestArea = this.toNumber(largest.data.area);

    const bestValue = found.reduce((best, cur) => {
      const curArea = this.toNumber(cur.data.area);
      const bestArea = this.toNumber(best.data.area);
      if (curArea <= 0) return best;
      if (bestArea <= 0) return cur;
      const curPM = this.toNumber(cur.data.price) / curArea;
      const bestPM = this.toNumber(best.data.price) / bestArea;
      return curPM < bestPM ? cur : best;
    });
    const bestValueIdx = found.indexOf(bestValue) + 1;
    const bestValuePM = Math.round(
      this.toNumber(bestValue.data.price) /
        Math.max(1, this.toNumber(bestValue.data.area)),
    );
    const maxPrice = Math.max(...propertyRows.map((r) => r.price), 1);
    const maxArea = Math.max(...propertyRows.map((r) => r.area), 1);

    const propertyCardsHtml = propertyRows
      .map((row) => {
        const isCheapest = row.idx === cheapestIdx;
        const isLargest = row.idx === largestIdx;
        const isBestValue = row.idx === bestValueIdx;
        const priceBar = Math.round((row.price / maxPrice) * 100);
        const areaBar = Math.round((row.area / maxArea) * 100);
        const badges = [
          isCheapest ? 'GIÁ TỐT NHẤT' : '',
          isLargest ? 'DIỆN TÍCH LỚN' : '',
          isBestValue ? 'GIÁ/M² TỐT' : '',
        ].filter((b) => b);
        const badgesHtml = badges
          .map(
            (b) =>
              `<span style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;font-weight:600;">${b}</span>`,
          )
          .join('');
        const cardBg = isCheapest || isBestValue ? '#f0f7ff' : '#ffffff';
        const cardBorder =
          badges.length > 0 ? '2px solid #667eea' : '1px solid #e0e0e0';

        return `
<div style="background:${cardBg};border:${cardBorder};border-radius:8px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <span style="font-weight:700;color:#667eea;font-size:14px;">Bất động sản ${row.idx}</span>
        <span style="font-size:11px;color:#666;">${row.type}</span>
    </div>
    ${badgesHtml ? `<div style="margin-bottom:8px;">${badgesHtml}</div>` : ''}
    <div style="background:#f9f9f9;padding:8px;border-radius:4px;margin-bottom:8px;font-size:12px;line-height:1.4;color:#333;">
        <strong>${row.title.substring(0, 60)}${row.title.length > 60 ? '...' : ''}</strong><br/>
        <span style="color:#666;font-size:11px;">${row.location.substring(0, 50)}${row.location.length > 50 ? '...' : ''}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
            <span style="font-size:11px;color:#666;font-weight:500;">Giá</span>
            <div style="font-weight:700;color:#d32f2f;font-size:13px;">${row.priceFormatted}</div>
            <div style="width:100%;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;background:linear-gradient(90deg,#d32f2f,#f44336);width:${priceBar}%;border-radius:2px;"></div>
            </div>
        </div>
        <div>
            <span style="font-size:11px;color:#666;font-weight:500;">Diện tích</span>
            <div style="font-weight:700;color:#1976d2;font-size:13px;">${row.areaFormatted}</div>
            <div style="width:100%;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;background:linear-gradient(90deg,#1976d2,#42a5f5);width:${areaBar}%;border-radius:2px;"></div>
            </div>
        </div>
    </div>
    <div style="background:#f5f5f5;padding:6px 8px;border-radius:4px;text-align:center;font-size:13px;color:#333;font-weight:600;">
        ${row.pricePerM2Formatted}/m² <span style="color:#999;">|</span> ${row.type}
    </div>
</div>`;
      })
      .join('');

    const htmlTable = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:12px 0;max-width:100%;">
    <h3 style="color:#1a1a1a;margin:0 0 16px 0;font-size:16px;font-weight:700;">So sánh ${found.length} bất động sản</h3>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">${propertyCardsHtml}</div>
    <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e3f2fd 100%);border-left:4px solid #2196F3;padding:12px;border-radius:6px;margin-bottom:12px;">
        <h4 style="color:#1565c0;margin:0 0 10px 0;font-size:13px;font-weight:700;">KẾT LUẬN PHÂN TÍCH</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#333;line-height:1.6;">
            <div style="background:rgba(211,47,47,0.08);padding:8px;border-radius:4px;border-left:3px solid #d32f2f;"><strong style="color:#d32f2f;">Giá rẻ nhất</strong><br/>Căn ${cheapestIdx}: ${this.formatVnd(cheapestPrice)}</div>
            <div style="background:rgba(25,118,210,0.08);padding:8px;border-radius:4px;border-left:3px solid #1976d2;"><strong style="color:#1976d2;">Diện tích lớn</strong><br/>Căn ${largestIdx}: ${this.formatArea(largestArea)}</div>
            <div style="background:rgba(251,192,45,0.1);padding:8px;border-radius:4px;border-left:3px solid #fbc02d;grid-column:1/3;"><strong style="color:#f57f17;">Giá/m² tốt nhất</strong> - Căn ${bestValueIdx}: <strong style="color:#d32f2f;">${this.formatVnd(bestValuePM)}/m²</strong></div>
        </div>
    </div>
    <div style="background:#fff9c4;border-left:4px solid #fbc02d;padding:12px;border-radius:6px;color:#f57f17;font-size:12px;">
        <strong>Bạn muốn xem chi tiết hoặc tìm thêm lựa chọn khác?</strong>
    </div>
</div>`.trim();

    return {
      answer: htmlTable,
      sources,
      suggestedQuestions: [
        'Xem chi tiết bất động sản đầu tiên',
        'Tìm nhà tương tự dưới 5 tỷ',
        'Kinh nghiệm mua nhà lần đầu',
      ],
    };
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    // Prisma Decimal and similar numeric wrappers often arrive as objects.
    if (value && typeof value === 'object') {
      const numericLike = value as {
        toNumber?: () => number;
        toString?: () => string;
        valueOf?: () => unknown;
      };

      if (typeof numericLike.toNumber === 'function') {
        const n = numericLike.toNumber();
        if (Number.isFinite(n)) return n;
      }

      if (typeof numericLike.toString === 'function') {
        const asString = numericLike.toString();
        const parsed = Number(String(asString).replace(/[^\d.-]/g, ''));
        if (Number.isFinite(parsed)) return parsed;
      }

      if (typeof numericLike.valueOf === 'function') {
        const primitive = numericLike.valueOf();
        if (typeof primitive === 'number' && Number.isFinite(primitive))
          return primitive;
        if (typeof primitive === 'string') {
          const parsed = Number(primitive.replace(/[^\d.-]/g, ''));
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }

    return 0;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatVnd(value: unknown): string {
    const amount = this.toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} VNĐ`;
  }

  private formatArea(value: unknown): string {
    const area = this.toNumber(value);
    if (!Number.isFinite(area) || area <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(area)} m²`;
  }
}
