/**
 * @file ai-chat-compare.service.ts
 * @description Xử lý luồng so sánh BĐS (compare_property intent) trong chatbot.
 *
 * MỤC ĐÍCH:
 *   Khi user muốn so sánh 2 BĐS với nhau, service này:
 *   1. Xác định ID của 2 BĐS cần so sánh (qua nhiều chiến lược)
 *   2. Lấy thông tin chi tiết từ MySQL
 *   3. Render HTML table so sánh đẹp mắt (price bar, area bar, badges)
 *
 * 5 CHIẼN LƯỢC TÌM ID (theo độ ưu tiên):
 *   1. compareIds[] từ ParsedIntent (LLM đã trích xuất được ID cụ thể từ user)
 *   2. extractIdsFromHistory()   — Scan lịch sử chat gần đây tìm ID (ví dụ: "ID 123")
 *   3. getLastSources()          — Lấy BĐS từ lần search trước (Redis cache 30ph)
 *   4. findIdByDescription()     — Tìm theo mô tả văn bản (price + location + type)
 *   5. filterActiveIds()         — Loại BĐS không còn hoạt động (status != 1)
 *
 * KẼT QUẢ SẢN PHẨM (buildCompareAnswer):
 *   HTML có property cards với:
 *   - Price bar: thanh ngang của giá tương đối
 *   - Area bar: thanh ngang của diện tích tương đối
 *   - Badges: GIÁ TỐT NHẤT | DIỆN TÍCH LỚN | GIÁ/M² TỐT
 *   - Kết luận phân tích 3 tiêu chí
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSuggestedQuestionsByPreset } from './constants/suggested-questions.constants';

/** Loại nội bộ — một turn trong lịch sử chat (dùng để scan ID từ history). */
type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

/** Loại nội bộ — payload của một BDS trong response (cùng kiểu với types/ai.types.ts). */
type ChatSourcePayload = Record<string, unknown>;

/**
 * AiChatCompareService
 *
 * Được inject vào AiService và được gọi từ handleCompareFlow().
 * Phụ thuộc PrismaService để truy vấn MySQL (house / land tables).
 */
@Injectable()
export class AiChatCompareService {
  private readonly logger = new Logger(AiChatCompareService.name);
  private readonly frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:3000';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * filterActiveIds — Lọc ra những ID BĐS còn hoạt động (status = 1).
   *
   * Được gọi từ handleCompareFlow() ngay sau khi có danh sách ID ứng viên.
   * Mục đích: tránh so sánh BĐS đã bị xóa/ẩn, trả thông báo phù hợp cho user.
   *
   * FLOW:
   *   1. Query song song (Promise.all) cả bảng house và land với điều kiện
   *      id IN [...ids] AND status = 1  → chỉ lấy field id để giảm tải DB.
   *   2. Gom tất cả id tìm được vào activeSet (Set<number>) để lookup O(1).
   *   3. Chia ids gốc thành:
   *      - active[]: id có trong activeSet → an toàn để so sánh
   *      - stale[]:  id không có trong activeSet → BĐS đã xóa/hết hạn
   *
   * @param ids  - Mảng ID cần kiểm tra (có thể là house ID hoặc land ID)
   * @returns    { active: number[], stale: number[] }
   *             active.length >= 2 mới có thể tiếp tục so sánh
   *
   * LƯU Ý: Một ID có thể tồn tại ở cả house lẫn land nếu DB bị trùng,
   * nhưng trường hợp này cực hiếm và activeSet sẽ tự dedupe.
   */
  async filterActiveIds(
    ids: number[],
  ): Promise<{ active: number[]; stale: number[] }> {
    if (!ids || ids.length === 0) return { active: [], stale: [] };

    const [houses, lands] = await Promise.all([
      this.prisma.house.findMany({
        where: { id: { in: ids }, status: 1 },
        select: { id: true },
      }),
      this.prisma.land.findMany({
        where: { id: { in: ids }, status: 1 },
        select: { id: true },
      }),
    ]);

    const activeSet = new Set<number>([
      ...houses.map((h) => h.id),
      ...lands.map((l) => l.id),
    ]);

    const active = ids.filter((id) => activeSet.has(id));
    const stale = ids.filter((id) => !activeSet.has(id));

    return { active, stale };
  }

  /**
   * extractIdsFromHistory — Trích xuất ID BĐS từ lịch sử hội thoại gần đây.
   *
   * Đây là Chiến lược 5 (cuối cùng) trong compare flow:
   * khi user nói "so sánh 2 căn đó" mà không chỉ rõ ID hay giá.
   *
   * FLOW:
   *   1. Lọc ra tối đa 8 turn gần nhất có role='assistant'.
   *   2. Duyệt ngược từ turn mới nhất đến cũ hơn.
   *      Ưu tiên turn mới nhất để tránh lấy nhầm ID từ cuộc tìm kiếm cũ.
   *   3. Với mỗi turn, áp 3 nhóm regex:
   *      - idPatterns:       /\bID\s*[:\s#]?\s*(\d+)\b/gi
   *                          → Match: "ID 123", "ID: 456", "ID#789"
   *      - urlPatterns:      /\/(?:houses|lands|nha|dat)\/(\d+)/gi
   *                          → Match: "/houses/123", "/lands/456"
   *      - sourceIdPatterns: /"sourceId"\s*:\s*(\d+)/g
   *                          → Match: JSON payload "sourceId": 123
   *   4. Dedupe bằng Set<number>, bỏ qua ID <= 0 hoặc NaN.
   *   5. Nếu turn hiện tại tìm được ít nhất 1 ID → trả về ngay (không tiếp tục).
   *
   * @param memory - Mảng ChatTurn[] từ Redis conversation state
   * @returns      Mảng ID duy nhất theo thứ tự xuất hiện, hoặc [] nếu không tìm thấy
   */
  extractIdsFromHistory(memory: ChatTurn[]): number[] {
    const assistantTurns = memory
      .filter((t) => t.role === 'assistant')
      .slice(-8);

    // Prefer the most recent assistant turn that includes IDs to avoid stale matches.
    for (let i = assistantTurns.length - 1; i >= 0; i -= 1) {
      const text = assistantTurns[i].text;

      const idPatterns = [...text.matchAll(/\bID\s*[:\s#]?\s*(\d+)\b/gi)];
      const urlPatterns = [
        ...text.matchAll(/\/(?:houses|lands|nha|dat)\/(\d+)/gi),
      ];
      const sourceIdPatterns = [...text.matchAll(/"sourceId"\s*:\s*(\d+)/g)];

      const seen = new Set<number>();
      const ids: number[] = [];

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

      if (ids.length > 0) return ids;
    }

    return [];
  }

  /**
   * extractPriceFromText — Trích xuất giá tiền (VNĐ) từ chuỗi mô tả tự do.
   *
   * Được gọi bởi findByPriceAndLocation() và findIdByDescription()
   * để lấy mức giá làm tiêu chí tìm kiếm chính xác nhất.
   *
   * 3 PATTERN NHẬN DẠNG (theo thứ tự ưu tiên):
   *   1. Dạng số phân cách bằng dấu chấm:
   *      "2.050.000.000", "500.000.000 đ", "3.200.000.000 đồng"
   *      → Xóa dấu chấm → parse Number trực tiếp
   *
   *   2. Dạng "X tỷ Y triệu":
   *      "2 tỷ", "1.5 tỷ", "2 tỷ 500 triệu", "3,2 tỷ"
   *      → Tính: ty * 1_000_000_000 + trieu * 1_000_000
   *
   *   3. Dạng "X triệu":
   *      "500 triệu", "800 tr"
   *      → Tính: num * 1_000_000
   *
   * @param text  - Chuỗi mô tả tự do (ví dụ: "đất Sơn Trà giá 3 tỷ")
   * @returns     Giá dạng số nguyên (VNĐ), hoặc null nếu không tìm thấy
   */
  extractPriceFromText(text: string): number | null {
    // Match Vietnamese dot-separated format: 2.050.000.000 (đ/đồng/vnd optional)
    const dotSepMatch = text.match(
      /(\d{1,3}(?:\.\d{3}){2,})\s*(?:đ|dong|đồng|vnd)?/i,
    );
    if (dotSepMatch) {
      const num = Number(dotSepMatch[1].replace(/\./g, ''));
      if (Number.isFinite(num) && num > 0) return num;
    }

    // Match "X tỷ Y triệu" or "X.Y tỷ"
    const tyMatch = text.match(
      /(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty)\s*(?:(\d+)\s*(?:triệu|trieu|tr))?/i,
    );
    if (tyMatch) {
      const ty = Number(tyMatch[1].replace(',', '.'));
      const trieu = tyMatch[2] ? Number(tyMatch[2]) : 0;
      const total = ty * 1_000_000_000 + trieu * 1_000_000;
      if (Number.isFinite(total) && total > 0) return total;
    }

    // Match "X triệu"
    const trieuMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr)/i);
    if (trieuMatch) {
      const num = Number(trieuMatch[1].replace(',', '.')) * 1_000_000;
      if (Number.isFinite(num) && num > 0) return num;
    }

    return null;
  }

  /**
   * extractSourceTypeFromText — Xác định loại BĐS từ mô tả văn bản.
   *
   * Normalize text (bỏ dấu, lowercase) rồi so khớp với keyword list:
   *   - 'land'  ← "dat", "nen", "dat nen", "lo dat"
   *   - 'house' ← "nha", "can ho", "chung cu", "biet thu", "nha pho"
   *   - null    ← Không xác định được (không ảnh hưởng luồng, sẽ query cả 2 bảng)
   *
   * Kết quả được dùng để thu hẹp phạm vi query MySQL:
   * nếu là 'land' → chỉ query bảng land, bỏ qua house và ngược lại.
   *
   * @param text  - Mô tả tự do từ user
   * @returns     'house' | 'land' | null
   */
  extractSourceTypeFromText(text: string): 'house' | 'land' | null {
    const norm = this.normalizeText(text);
    if (/\b(dat|nen|dat nen|lo dat)\b/.test(norm)) return 'land';
    if (/\b(nha|can ho|chung cu|biet thu|nha pho)\b/.test(norm)) return 'house';
    return null;
  }

  /**
   * extractLocationTokens — Trích xuất token vị trí từ mô tả văn bản.
   *
   * Được dùng bởi findByPriceAndLocation() để build OR filter cho MySQL
   * (district/ward/city/street/title LIKE '%token%').
   *
   * FLOW:
   *   1. normalizeText() → bỏ dấu, lowercase, xóa ký tự đặc biệt.
   *   2. Tách thành mảng token theo whitespace.
   *   3. Lọc bỏ:
   *      - Token ngắn < 2 ký tự
   *      - Token thuần số (giá tiền, diện tích)
   *      - Stop words không mang thông tin vị trí:
   *        dat, nha, can, ban, cho, thue, mua, gia, dien, tich, phong, ngu, tang...
   *   4. Lấy tối đa 10 token đầu tiên.
   *
   * Ví dụ: "đất nền Sơn Trà 100m² giá 3 tỷ" → ["son", "tra"]
   *
   * @param text  - Mô tả tự do
   * @returns     Mảng token vị trí (đã normalize, không dấu), tối đa 10 phần tử
   */
  extractLocationTokens(text: string): string[] {
    const norm = this.normalizeText(text);
    // Remove numeric-only tokens and common stop words, keep location-like words
    const locationStops = new Set([
      'dat',
      'nha',
      'can',
      'ban',
      'cho',
      'thue',
      'mua',
      'voi',
      'va',
      'de',
      'la',
      'so',
      'gia',
      'dien',
      'tich',
      'phong',
      'ngu',
      'tang',
    ]);
    return norm
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !locationStops.has(t) && !/^\d+$/.test(t))
      .slice(0, 10);
  }

  /**
   * findByPriceAndLocation — Tìm BĐS bằng giá + vị trí + loại (độ chính xác cao).
   *
   * Đây là Strategy chính (và chính xác nhất) để tìm BĐS khi mô tả có chứa giá tiền cụ thể.
   *
   * SCORING ALGORITHM:
   *   - Price proximity (điểm quan trọng nhất, dùng để phân biệt khi nhiều BĐS cùng khu vực):
   *       diff < 0.1%  → +20 điểm  (khớp gần chính xác)
   *       diff < 1%    → +15 điểm
   *       diff < 5%    → +10 điểm  (tolerance mặc định ±5% khi query)
   *       diff < 10%   →  +5 điểm
   *       diff >= 10%  →  +1 điểm  (khớp yếu, hiếm khi xảy ra)
   *   - Location tokens: mỗi token khớp trong title/address = +3 điểm
   *   - Threshold: cần tối thiểu 3 điểm mới trả kết quả (tránh false positive)
   *
   * QUERY STRATEGY (2 vòng):
   *   Vòng 1 (strict): price range (±5%) + location OR filters → lấy tối đa 100 records mỗi loại.
   *   Vòng 2 (fallback): nếu vòng 1 = 0 kết quả, thử lại chỉ với price range (bỏ location).
   *   Sau đó chọn bản ghi có score cao nhất từ tất cả candidates.
   *
   * @param description - Mô tả tự do (đã được Gemini parse ra từ intent.compareDescriptions)
   * @param excludeId   - ID đã tìm được cái trước (tránh match trùng 2 mô tả vào cùng 1 BĐS)
   * @returns           ID số nguyên của BĐS khớp tốt nhất, hoặc null nếu không đạt ngưỡng
   */
  async findByPriceAndLocation(
    description: string,
    excludeId?: number,
  ): Promise<number | null> {
    const price = this.extractPriceFromText(description);
    const sourceType = this.extractSourceTypeFromText(description);
    const locationTokens = this.extractLocationTokens(description);

    if (price === null && locationTokens.length === 0) return null;

    // Build price range: allow 5% tolerance for rounding
    const priceTolerance = price ? price * 0.05 : 0;
    const minPrice = price ? price - priceTolerance : undefined;
    const maxPrice = price ? price + priceTolerance : undefined;

    const priceFilter =
      minPrice !== undefined && maxPrice !== undefined
        ? { gte: minPrice, lte: maxPrice }
        : undefined;

    // Build location OR filters from tokens
    const locationOrFilters =
      locationTokens.length > 0
        ? locationTokens.flatMap((token) => [
            { district: { contains: token } },
            { ward: { contains: token } },
            { city: { contains: token } },
            { street: { contains: token } },
            { title: { contains: token } },
          ])
        : undefined;

    const selectFields = {
      id: true,
      title: true,
      street: true,
      ward: true,
      district: true,
      city: true,
      price: true,
      area: true,
    } as const;

    type DbRecord = {
      id: number;
      title: string | null;
      street: string | null;
      ward: string | null;
      district: string | null;
      city: string | null;
      price: unknown;
      area: unknown;
    };

    const scoreRecord = (r: DbRecord): number => {
      if (excludeId !== undefined && r.id === excludeId) return -1;

      let score = 0;
      const recordPrice = this.toNumber(r.price);

      // Price proximity scoring (most important for disambiguation)
      if (price !== null && recordPrice > 0) {
        const diff = Math.abs(recordPrice - price);
        const pct = diff / price;
        if (pct < 0.001)
          score += 20; // exact match
        else if (pct < 0.01)
          score += 15; // ~1% off
        else if (pct < 0.05)
          score += 10; // ~5% off
        else if (pct < 0.1)
          score += 5; // ~10% off
        else score += 1;
      }

      // Location scoring
      const recordNorm = this.normalizeText(
        [r.title, r.street, r.ward, r.district, r.city]
          .filter(Boolean)
          .join(' '),
      );
      for (const token of locationTokens) {
        if (recordNorm.includes(token)) score += 3;
      }

      return score;
    };

    try {
      const buildWhere = (extraWhere?: Record<string, unknown>) => {
        const where: Record<string, unknown> = { status: 1, ...extraWhere };
        if (priceFilter) where.price = priceFilter;
        if (locationOrFilters) where.OR = locationOrFilters;
        return where;
      };

      // Query based on detected source type, or both if unknown
      const candidates: DbRecord[] = [];

      if (sourceType !== 'house') {
        const lands = await this.prisma.land.findMany({
          where: buildWhere() as never,
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: selectFields,
        });
        candidates.push(...(lands as DbRecord[]));
      }

      if (sourceType !== 'land') {
        const houses = await this.prisma.house.findMany({
          where: buildWhere() as never,
          orderBy: { updatedAt: 'desc' },
          take: 100,
          select: selectFields,
        });
        candidates.push(...(houses as DbRecord[]));
      }

      // If strict query returned nothing, try with just price filter
      if (candidates.length === 0 && priceFilter) {
        if (sourceType !== 'house') {
          const lands = await this.prisma.land.findMany({
            where: { status: 1, price: priceFilter } as never,
            orderBy: { updatedAt: 'desc' },
            take: 100,
            select: selectFields,
          });
          candidates.push(...(lands as DbRecord[]));
        }
        if (sourceType !== 'land') {
          const houses = await this.prisma.house.findMany({
            where: { status: 1, price: priceFilter } as never,
            orderBy: { updatedAt: 'desc' },
            take: 100,
            select: selectFields,
          });
          candidates.push(...(houses as DbRecord[]));
        }
      }

      if (candidates.length === 0) return null;

      // Score and pick best
      let bestId: number | null = null;
      let bestScore = 0;
      for (const c of candidates) {
        const s = scoreRecord(c);
        if (s > bestScore) {
          bestScore = s;
          bestId = c.id;
        }
      }

      return bestScore >= 3 ? bestId : null;
    } catch (error) {
      this.logger.warn(
        `findByPriceAndLocation failed: ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  /**
   * findIdByDescription — Tìm ID của BĐS khớp với mô tả văn bản tự do.
   *
   * Được gọi từ handleCompareFlow() khi Gemini parse ra intent.compareDescriptions[].
   * Ví dụ: ["nhà Sơn Trà 3 tỷ", "đất Hải Châu 2 tỷ"] → gọi 2 lần, lần 2 truyền excludeId của lần 1.
   *
   * 2 CHIẺN LƯỢC THEO THỨ TỰ:
   *   Strategy 1 — findByPriceAndLocation():
   *     Nếu mô tả có giá tiền → tìm chính xác theo price range + location.
   *     Score-based: trả ngay nếu đạt ngưỡng >= 3 điểm.
   *     Ưu điểm: nhanh, chính xác hơn vì giá là đặc trưng riêng biệt.
   *
   *   Strategy 2 — findByTextInDb() (chỉ chạy nếu Strategy 1 trả null):
   *     Tokenize mô tả, loại stop words, tính điểm khớp token trên title/address.
   *     Chận hơn nhưng bao quát hơn (không cần giá).
   *
   * @param description - Mô tả tự do (ví dụ: "đất Sơn Trà giá 3 tỷ")
   * @param excludeId   - ID đã tìm trước (tránh match trùng 2 mô tả → 1 BĐS)
   * @returns           ID khớp tốt nhất, hoặc null nếu cả 2 chiến lược thất bại
   */
  async findIdByDescription(
    description: string,
    excludeId?: number,
  ): Promise<number | null> {
    // Strategy 1: Try precise price+location+type matching first
    const priceMatch = await this.findByPriceAndLocation(
      description,
      excludeId,
    );
    if (priceMatch !== null) {
      this.logger.log(
        `findIdByDescription: matched by price+location → id=${priceMatch}`,
      );
      return priceMatch;
    }

    // Strategy 2: Fall back to text token scoring
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
   * findByTextInDb — Tìm BĐS bằng token scoring trên MySQL (fallback cuối cùng).
   *
   * Chạy chậm hơn findByPriceAndLocation nhưng tổng quát hơn:
   * không cần giá tiền, chỉ cần ít nhất 1 token vị trí/loại để tìm.
   *
   * SCORING ALGORITHM:
   *   - Unigram trong title:   +2 điểm / token
   *   - Unigram trong address: +1 điểm / token
   *   - Bigram trong fullText: +3 điểm / bigram (cụm 2 từ liên tiếp)
   *   Ngưỡng chấp nhận: >= 2 điểm (tránh false positive do token quá chung)
   *
   * 2 PHA QUERY (tối ưu hiệu năng):
   *   Phase 1 (targeted — fast path):
   *     Lọc theo OR filter trên tất cả token (title/street/ward/district/city LIKE '%t%').
   *     Lấy tối đa 250 records mỗi bảng. Nếu score >= 2 → trả ngay.
   *   Phase 2 (broad scan — chỉ chạy khi Phase 1 không đạt score):
   *     Quét toàn bộ bảng (status=1, lấy tối đa 1200 records mỗi bảng).
   *     Tốn nhiều RAM hơn nhưng đảm bảo không bỏ sót.
   *
   * @param description         - Mô tả gốc (chỉ dùng khi precomputedTokens không có)
   * @param excludeId           - ID đã tìm được trước (tránh match trùng)
   * @param precomputedTokens   - Token đã tính sẵn từ findIdByDescription() (để khỏi tính lại)
   * @returns                   ID khớp tốt nhất (score >= 2), hoặc null
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

  /**
   * buildCompareAnswer — Xây dựng kết quả so sánh dạng HTML cho 2+ BĐS.
   *
   * Đây là bước cuối cùng trong compare flow: sau khi đã có ít nhất 2 active ID,
   * hàm này lấy dữ liệu, tính metrics và render ra giao diện so sánh hóa.
   *
   * FLOW 5 BƯỚC:
   *   1. findById() song song cho tất cả ID (query cả house và land).
   *
   *   2. Nếu có hỗn hợp house+land và ít nhất 2 cái cùng loại
   *      → giữ lại cùng loại để so sánh có ý nghĩa hơn.
   *      Nếu mỗi loại chỉ 1 cái → giữ cả (user có thể muốn so sánh chéo loại).
   *
   *   3. Tính 3 metrics:
   *      - cheapest:  BĐS rẻ tiền nhất
   *      - largest:   BĐS có diện tích lớn nhất
   *      - bestValue: BĐS có giá/m² thấp nhất (bỏ qua BĐS area = 0)
   *
   *   4. Render HTML card cho từng BĐS:
   *      - Price bar: thanh ngang biểu diễn % giá so với maxPrice
   *      - Area bar:  thanh ngang biểu diễn % diện tích so với maxArea
   *      - Badges: GIA TOT NHAT | DIEN TICH LON | GIA/M2 TOT
   *      - Inline style (không dùng CSS class) → hoạt động mọi môi trường
   *
   *   5. Render bảng kết luận 3 tiêu chí + nút CTA.
   *      Trả về: { answer (HTML string), sources[], suggestedQuestions[] }
   *
   * @param ids - Mảng ID cần so sánh (tối thiểu 2, đã qua filterActiveIds)
   * @returns   { answer: HTML, sources: ChatSourcePayload[], suggestedQuestions: string[] }
   */
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
          'Minh chua tim thay du bat dong san de so sanh. Ban co the mo lai 2 tin can so sanh hoac gui link chi tiet cua tung tin.',
        sources: [],
        suggestedQuestions: getSuggestedQuestionsByPreset('compare_property'),
      };
    }

    const sources: ChatSourcePayload[] = [];

    const propertyRows = found.map((item, idx) => {
      const d = item.data;
      const price = this.toNumber(d.price);
      const area = this.toNumber(d.area);
      const pricePerM2 = area > 0 ? Math.round(price / area) : 0;
      const url = `${this.frontendUrl}/${item.type === 'house' ? 'houses' : 'lands'}/${String(d.id)}`;
      const typeLabel = item.type === 'house' ? 'Nha' : 'Dat';

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
          isCheapest ? 'GIA TOT NHAT' : '',
          isLargest ? 'DIEN TICH LON' : '',
          isBestValue ? 'GIA/M2 TOT' : '',
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
        <span style="font-weight:700;color:#667eea;font-size:14px;">Bat dong san ${row.idx}</span>
        <span style="font-size:11px;color:#666;">${row.type}</span>
    </div>
    ${badgesHtml ? `<div style="margin-bottom:8px;">${badgesHtml}</div>` : ''}
    <div style="background:#f9f9f9;padding:8px;border-radius:4px;margin-bottom:8px;font-size:12px;line-height:1.4;color:#333;">
        <strong>${row.title.substring(0, 60)}${row.title.length > 60 ? '...' : ''}</strong><br/>
        <span style="color:#666;font-size:11px;">${row.location.substring(0, 50)}${row.location.length > 50 ? '...' : ''}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
            <span style="font-size:11px;color:#666;font-weight:500;">Gia</span>
            <div style="font-weight:700;color:#d32f2f;font-size:13px;">${row.priceFormatted}</div>
            <div style="width:100%;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;background:linear-gradient(90deg,#d32f2f,#f44336);width:${priceBar}%;border-radius:2px;"></div>
            </div>
        </div>
        <div>
            <span style="font-size:11px;color:#666;font-weight:500;">Dien tich</span>
            <div style="font-weight:700;color:#1976d2;font-size:13px;">${row.areaFormatted}</div>
            <div style="width:100%;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;background:linear-gradient(90deg,#1976d2,#42a5f5);width:${areaBar}%;border-radius:2px;"></div>
            </div>
        </div>
    </div>
    <div style="background:#f5f5f5;padding:6px 8px;border-radius:4px;text-align:center;font-size:13px;color:#333;font-weight:600;">
        ${row.pricePerM2Formatted}/m2 <span style="color:#999;">|</span> ${row.type}
    </div>
</div>`;
      })
      .join('');

    const htmlTable = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:12px 0;max-width:100%;">
    <h3 style="color:#1a1a1a;margin:0 0 16px 0;font-size:16px;font-weight:700;">So sanh ${found.length} bat dong san</h3>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">${propertyCardsHtml}</div>
    <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e3f2fd 100%);border-left:4px solid #2196F3;padding:12px;border-radius:6px;margin-bottom:12px;">
        <h4 style="color:#1565c0;margin:0 0 10px 0;font-size:13px;font-weight:700;">KET LUAN PHAN TICH</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#333;line-height:1.6;">
            <div style="background:rgba(211,47,47,0.08);padding:8px;border-radius:4px;border-left:3px solid #d32f2f;"><strong style="color:#d32f2f;">Gia re nhat</strong><br/>Can ${cheapestIdx}: ${this.formatVnd(cheapestPrice)}</div>
            <div style="background:rgba(25,118,210,0.08);padding:8px;border-radius:4px;border-left:3px solid #1976d2;"><strong style="color:#1976d2;">Dien tich lon</strong><br/>Can ${largestIdx}: ${this.formatArea(largestArea)}</div>
            <div style="background:rgba(251,192,45,0.1);padding:8px;border-radius:4px;border-left:3px solid #fbc02d;grid-column:1/3;"><strong style="color:#f57f17;">Gia/m2 tot nhat</strong> - Can ${bestValueIdx}: <strong style="color:#d32f2f;">${this.formatVnd(bestValuePM)}/m2</strong></div>
        </div>
    </div>
    <div style="background:#fff9c4;border-left:4px solid #fbc02d;padding:12px;border-radius:6px;color:#f57f17;font-size:12px;">
        <strong>Ban muon xem chi tiet hoac tim them lua chon khac?</strong>
    </div>
</div>`.trim();

    return {
      answer: htmlTable,
      sources,
      suggestedQuestions: getSuggestedQuestionsByPreset('compare_property'),
    };
  }

  /**
   * stringifyError — Chuyển đối lỗi sang chuỗi để ghi log.
   * Được dùng trong mọi catch block của service này.
   * - Error instance → lấy .message
   * - Giá trị khác (string, number, object) → String() cưỡng bức
   */
  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * toNumber — Chuyển đổi giá trị bất kỳ sang số thực an toàn.
   *
   * Cần thiết vì Prisma Decimal (Prisma.Decimal) về dạng object,
   * không phải số thường. Hàm này xử lý 3 trường hợp:
   *   1. number thường   → trả trực tiếp (0 nếu NaN/Infinity)
   *   2. string           → xóa ký tự không phải số rồi parse
   *   3. object (Decimal) → thử lần lượt: .toNumber() → .toString() → .valueOf()
   * Trả 0 nếu tất cả đều thất bại.
   *
   * @param value - Giá trị đầu vào (number, string, Prisma.Decimal, unknown)
   * @returns     Số thực hữu hạn >= 0, hoặc 0 nếu không parse được
   */
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

  /**
   * normalizeText — Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không phân biệt dấu.
   *
   * Quy trình: NFD decompose → xóa diacritic → lowercase
   *   → xóa ký tự không phải alphanum/space → gập nhiều space → trim.
   *
   * Ví dụ: "Đại Lộ Đông Tây" → "dai lo dong tay"
   *
   * Được dùng ở khắp nơi trong service: token scoring, source type detection,
   * location token extraction, price detection và scoring.
   */
  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * formatVnd — Định dạng số tiền thành chuỗi VNĐ hiển thị cho user.
   * Ví dụ: 3200000000 → "3.200.000.000 VNĐ"
   * Trả 'N/A' nếu giá trị <= 0 hoặc không hợp lệ.
   */
  private formatVnd(value: unknown): string {
    const amount = this.toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} VNĐ`;
  }

  /**
   * formatArea — Định dạng diện tích thành chuỗi m² hiển thị cho user.
   * Ví dụ: 120 → "120 m²"
   * Trả 'N/A' nếu diện tích <= 0 hoặc không hợp lệ.
   */
  private formatArea(value: unknown): string {
    const area = this.toNumber(value);
    if (!Number.isFinite(area) || area <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(area)} m²`;
  }
}

