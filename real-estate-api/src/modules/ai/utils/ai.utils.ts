/**
 * @file ai.utils.ts
 * @description Tập hợp các hàm tiện ích (Utility Class) dùng xuyên suốt toàn bộ AI module.
 *
 * TẤT CẢ LÀ STATIC METHODS — không cần khởi tạo, gọi trực tiếp qua AiUtils.method().
 *
 * NHÓM CHỨC NĂNG:
 *
 * 1. FORMAT & CONVERT (Cơ bản)
 *    normalizeText()          — Chuẩn hoá tiếng Việt: bỏ dấu, lowercase, dọn khoảng trắng
 *    toNumber()               — Ép kiểu an toàn sang số (để tránh NaN)
 *    toVnd()                  — Chuyển "2.5 tỷ" | "500 triệu" → số nguyên VND
 *    formatVnd()              — Format số người Việt: 2.500.000 VNĐ
 *    formatArea()             — Format diện tích: 85 m²
 *    stringifyError()         — Chuyển error → chuỗi an toàn cho logger
 *    compactMemoryText()      — Cắt ngắn chuỗi dài (dùng cho chat history)
 *
 * 2. LLM ENGINE (Trái tim của hệ thống)
 *    generateLlmResponse()    — Gọi LLM với fallback chain: Gemini → Groq → OpenRouter
 *
 * 3. INTENT PARSING
 *    parseIntent()            — Phân tích ý định bằng Gemini (LLM-first, regex fallback)
 *    parseIntentRegex()       — Fallback parser dùng regex thuần (deterministic)
 *    parseCompareDescriptions()— Tách 2 mô tả BDS từ câu "so sánh X với Y"
 *    extractAllPricesFromText()— Tích xuất tất cả giá tiền trong đoạn text
 *
 * 4. VECTOR SEARCH HELPERS
 *    buildBm25SparseVector()  — Tính BM25 Sparse Vector từ text (cho Hybrid Search)
 *    buildQdrantFilter()      — Xây dựng metadata filter cho Qdrant query
 *    applyIntentFilter()      — Lọc VectorHit[] theo giá, loại, vị trí
 *
 * 5. RESPONSE GENERATION
 *    toDisplayAnswer()        — Chuyển JSON từ LLM → chuỗi markdown để hiển thị
 *    toFastAnswer()           — Tạo câu trả lời nhanh khi LLM fail (không cần AI)
 *    buildIntentInstructions()— Sinh system prompt riêng theo từng loại intent
 *    buildSuggestedQuestions()— Gợi ý câu hỏi tiếp theo phù hợp ngữ cảnh
 *    tryParseJson()           — Parse JSON an toàn, trả null thay vì throw
 */
import axios from 'axios';
import { ParsedIntent, VectorHit } from '../types/ai.types';

/**
 * AiUtils — Utility class tĩnh (static-only).
 * Chứa toàn bộ logic hệ thống không phụ thuộc vào NestJS DI hay state.
 */
export class AiUtils {
  /**
   * normalizeText — Chuẩn hoá tiếng Việt cho xử lý NLP.
   * Quy trình: lowercase → bỏ dấu (NFD) → đ → d → loại ký tự đặc biệt → dọn khoảng trắng
   * Ví dụ: "Tìm Nhà ở Đà Nẵng" → "tim nha o da nang"
   * Được gọi ở mọi nơi trước khi chạy regex match.
   */
  static normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * toNumber — Ép kiểu an toàn sang number.
   * Trả 0 nếu null / undefined / NaN thay vì throw.
   * Dùng khi lấy gia/diện tích từ Prisma (BigInt/Decimal).
   */
  static toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const num = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  /**
   * toVnd — Chuyển số + đơn vị sang VND.
   * Ví dụ: toVnd('2.5', 'ty') → 2_500_000_000
   *          toVnd('500', 'trieu') → 500_000_000
   * Trả undefined nếu không xác định được đơn vị (dùng để bế khỏi set giá).
   */
  static toVnd(amountText: string, unit?: string): number | undefined {
    const amount = Number(String(amountText).replace(/,/g, '.'));
    if (!Number.isFinite(amount)) return undefined;

    const normalizedUnit = (unit || '').toLowerCase();
    if (normalizedUnit === 'ty') return amount * 1_000_000_000;
    if (normalizedUnit === 'trieu' || normalizedUnit === 'tr')
      return amount * 1_000_000;

    return undefined;
  }

  /**
   * formatVnd — Format số tiền theo định dạng Việt Nam.
   * Ví dụ: 2_500_000_000 → "2.500.000.000 VNĐ"
   * Trả 'N/A' nếu giá trị không hợp lệ.
   */
  static formatVnd(value: unknown): string {
    const amount = AiUtils.toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} VNĐ`;
  }

  /** formatArea — Format diện tích. Ví dụ: 85 → "85 m²". Trả 'N/A' nếu không hợp lệ. */
  static formatArea(value: unknown): string {
    const area = AiUtils.toNumber(value);
    if (!Number.isFinite(area) || area <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(area)} m²`;
  }

  /**
   * stringifyError — Chuyển error object sang chuỗi an toàn (không throw).
   * Dùng trong catch block khi log lỗi từ Gemini/Qdrant/Axios.
   */
  static stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  /**
   * compactMemoryText — Cắt ngắn và gộp khoảng trắng của chuỗi dài.
   * Dùng khi inject lịch sử chat vào prompt (giới hạn context window).
   * Ví dụ: compactMemoryText(longText, 300) → "..." nếu vượt 300 ky tự
   */
  static compactMemoryText(value: string, limit: number): string {
    const oneLine = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (oneLine.length <= limit) return oneLine;
    return `${oneLine.slice(0, Math.max(0, limit - 3))}...`;
  }

  /**
   * generateLlmResponse — Gọi LLM với cơ chế fallback đa tầng.
   *
   * LUỒNG GỌI:
   *   1. Thử lần lượt từng Gemini API key (comma-separated trong GEMINI_API_KEY)
   *      - Nếu 429 (rate-limit) → thử key tiếp theo
   *      - Nếu lỗi khác (5xx, timeout) → thoát vòng lặp, đi Groq
   *      - Nếu bị block bởi safety filter → log warn, đi key tiếp theo
   *   2. Fallback Groq LLaMA 3.3 70B (OpenAI-compatible API)
   *      - Convert Gemini format → OpenAI messages format
   *   3. Fallback OpenRouter (Gemini 2.5 Flash qua gateway)
   *   4. Trả null nếu tất cả đều fail → AiService dùng Fast Answer
   *
   * THƯ NHẠNG MODEL (Gemini 2.5):
   *   - thinkingBudget = 0: tắt thinking để tiết kiệm token quota
   *   - isJson = true: yêu cầu output JSON sạch (application/json MIME type)
   *
   * @param promptOrContents - Câu hỏi (string) hoặc mảng multi-turn (Gemini format)
   * @param systemInstruction - System role prompt cho LLM
   * @param options - { temperature, maxTokens, timeout, isJson }
   * @returns Chuỗi text từ LLM hoặc null nếu thất bại
   */
  static async generateLlmResponse(
    promptOrContents: string | any[],
    systemInstruction: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
      isJson?: boolean;
    } = {},
  ): Promise<string | null> {
    // Parse multiple Gemini keys separated by commas
    const rawGeminiKeys = process.env.GEMINI_API_KEY || '';
    const geminiApiKeys = rawGeminiKeys
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);

    const geminiModel = process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
    const geminiApiBase =
      process.env.GEMINI_API_URL ||
      'https://generativelanguage.googleapis.com/v1beta';

    // User's provided Groq Key as ultimate fallback
    const groqApiKey = process.env.GROQ_API_KEY || '';
    const groqModel = 'llama-3.3-70b-versatile';

    // OpenRouter fallback
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
    const openRouterModel = 'google/gemini-2.5-flash';

    const timeout = options.timeout || 15000;

    // Standardize contents
    const contents = Array.isArray(promptOrContents)
      ? promptOrContents
      : [{ role: 'user', parts: [{ text: promptOrContents }] }];

    const generationConfig: any = {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 1024,
    };
    if (options.isJson) {
      generationConfig.responseMimeType = 'application/json';
    }

    // For Gemini 2.5 thinking models, maxOutputTokens includes BOTH
    // thinking and output tokens. Cap thinking budget so actual output
    // isn't truncated by internal reasoning consuming the token quota.
    const isThinkingModel = geminiModel.includes('2.5');
    const thinkingConfig = isThinkingModel
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : {};

    // 1. Try Gemini Keys sequentially if rate-limited
    for (const apiKey of geminiApiKeys) {
      try {
        const resp = await axios.post(
          `${geminiApiBase}/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: contents,
            generationConfig: generationConfig,
            ...thinkingConfig,
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH',
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH',
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH',
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH',
              },
            ],
          },
          { timeout },
        );
        const text =
          resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = resp.data?.candidates?.[0]?.finishReason;

        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          console.warn(
            `[LLM] Gemini blocked by safety filters. Key: ${apiKey.substring(0, 8)}...`,
          );
          continue; // Maybe next key won't be blocked, but unlikely. Let's still fallback.
        }

        if (text) return text;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429) {
          console.warn(
            `[LLM] Gemini Rate Limit Hit for key starting with ${apiKey.substring(0, 8)}... Trying next key...`,
          );
          continue; // Try next key
        } else {
          console.warn(
            `[LLM] Gemini failed with status ${status}: ${AiUtils.stringifyError(err)}. Moving to next fallback...`,
          );
          break; // Not a rate limit issue, break out and try Groq
        }
      }
    }

    // 2. Fallback to Groq if all Gemini keys exhausted or failed
    if (groqApiKey) {
      console.log(`[LLM] Falling back to Groq API using model ${groqModel}...`);
      try {
        // Convert Gemini contents to OpenAI format
        const messages = [{ role: 'system', content: systemInstruction }];
        for (const c of contents) {
          // Gemini role 'model' -> OpenAI 'assistant'
          const role = c.role === 'model' ? 'assistant' : 'user';
          const textContent = c.parts?.[0]?.text || '';
          if (textContent) {
            messages.push({ role, content: textContent });
          }
        }

        const groqBody: any = {
          model: groqModel,
          messages: messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1024,
        };
        if (options.isJson) {
          groqBody.response_format = { type: 'json_object' };
          // Groq requires the prompt to contain the word "JSON"
          if (messages[0].role === 'system') {
            messages[0].content += ' (Please format the output as JSON)';
          } else {
            messages.unshift({
              role: 'system',
              content: 'Please format the output as JSON',
            });
          }
        }

        const resp = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          groqBody,
          {
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout,
          },
        );
        const text = resp.data?.choices?.[0]?.message?.content || '';
        if (text) return text;
      } catch (err: any) {
        console.error(
          `[LLM] Groq fallback failed: ${AiUtils.stringifyError(err)}`,
        );
      }
    }

    // 3. Fallback to OpenRouter if Groq also failed
    if (openRouterApiKey) {
      console.log(
        `[LLM] Falling back to OpenRouter API using model ${openRouterModel}...`,
      );
      try {
        // Convert Gemini contents to OpenAI format
        const messages = [{ role: 'system', content: systemInstruction }];
        for (const c of contents) {
          const role = c.role === 'model' ? 'assistant' : 'user';
          const textContent = c.parts?.[0]?.text || '';
          if (textContent) {
            messages.push({ role, content: textContent });
          }
        }

        const openRouterBody: any = {
          model: openRouterModel,
          messages: messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1024,
        };

        // Note: JSON object support in OpenRouter depends on the model.
        if (options.isJson) {
          openRouterBody.response_format = { type: 'json_object' };
        }

        const resp = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          openRouterBody,
          {
            headers: {
              Authorization: `Bearer ${openRouterApiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer':
                process.env.FRONTEND_URL || 'http://localhost:3000',
              'X-Title': 'BlacksCity Bot',
            },
            timeout,
          },
        );
        const text = resp.data?.choices?.[0]?.message?.content || '';
        if (text) return text;
      } catch (err: any) {
        console.error(
          `[LLM] OpenRouter fallback failed: ${AiUtils.stringifyError(err)}`,
        );
      }
    }

    return null;
  }

  /**
   * extractAllPricesFromText — Tích xuất tất cả giá tiền trong đoạn text.
   * Hỗ trợ 3 định dạng:
   *   1. Việt Nam dot-separated: 2.050.000.000 đ
   *   2. X tỷ Y triệu: "2 tỷ 50 triệu" → 2_050_000_000
   *   3. X triệu độc lập: "500 triệu"
   * Dùng trong AiChatCompareService để tìm BDS theo giá từ description.
   */
  static extractAllPricesFromText(text: string): number[] {
    const prices: number[] = [];
    const seen = new Set<number>();

    const addPrice = (p: number) => {
      if (Number.isFinite(p) && p > 0 && !seen.has(p)) {
        seen.add(p);
        prices.push(p);
      }
    };

    // Pattern 1: Vietnamese dot-separated format: 2.050.000.000 (đ/đồng/vnd optional)
    const dotSepRegex = /(\d{1,3}(?:\.\d{3}){2,})\s*(?:đ|dong|đồng|vnd)?/gi;
    let match: RegExpExecArray | null;
    while ((match = dotSepRegex.exec(text)) !== null) {
      const num = Number(match[1].replace(/\./g, ''));
      addPrice(num);
    }

    // Pattern 2: X tỷ Y triệu
    const tyRegex =
      /(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty)\s*(?:(\d+)\s*(?:triệu|trieu|tr))?/gi;
    while ((match = tyRegex.exec(text)) !== null) {
      const ty = Number(match[1].replace(',', '.'));
      const trieu = match[2] ? Number(match[2]) : 0;
      addPrice(ty * 1_000_000_000 + trieu * 1_000_000);
    }

    // Pattern 3: X triệu (standalone, not part of tỷ pattern)
    const trieuRegex = /(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr)(?!\s*\d)/gi;
    while ((match = trieuRegex.exec(text)) !== null) {
      const num = Number(match[1].replace(',', '.')) * 1_000_000;
      addPrice(num);
    }

    return prices;
  }

  /**
   * parseCompareDescriptions — Tách 2 mô tả BDS từ câu so sánh của user.
   * Ví dụ: "so sánh nhà 3 phòng nhưng Hải Châu với đất Sơn Trà"
   *          → ["nhà 3 phòng ngủ Hải Châu", "đất Sơn Trà"]
   * Lọc bỏ các cụm referential ("nhà này", "cái kia"...) không phải mô tả cụ thể.
   * Trả [] nếu không phân tích được 2 mô tả rõ ràng.
   */
  static parseCompareDescriptions(question: string): string[] {
    const stripped = question
      .replace(
        /^(so\s+s[aá]nh|compare|so\s+v[oớ]i|h[aã]y\s+so\s+s[aá]nh)\s*/i,
        '',
      )
      .trim();

    const splitRegex =
      /\s+(?:so\s+s[aá]nh\s+v[oớ]i|v[oớ]i|và|vs|or|hoặc|so\s+s[aá]nh)\s+/i;
    const parts = stripped
      .split(splitRegex)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (parts.length < 2) return [];

    const referentialPattern =
      /^(nh[aà]\s+n[aà]y|c[aá]i\s+n[aà]y|c[aá]n\s+n[aà]y|nh[aà]\s+[kđ][oóò]|c[aá]i\s+[kđ][oóò]|nh[aà]\s+kia|c[aá]i\s+kia|c[aá]i\s+tr[eê]n|c[aá]i\s+d[uư][oớ]i|hai\s+c[aá]i|2\s+c[aá]i|chu[nǹ]g|[cđ]h[uú]ng|nh[uư]ng\s+c[aá]i|v[uừ]a\s+tim|v[uừ]a\s+xem)$/i;

    const descriptions = parts.filter(
      (p) => !referentialPattern.test(p.trim()) && p.length >= 4,
    );

    return descriptions.length >= 2 ? descriptions.slice(0, 2) : [];
  }

  /**
   * LLM-based intent parsing with regex fallback.
   * Uses Gemini to understand natural language intent, extract entities,
   * and generate an optimized query for vector search (Query Expansion).
   */
  static async parseIntent(question: string): Promise<ParsedIntent> {
    // Fast-path: very short greetings don't need LLM
    const quickNorm = AiUtils.normalizeText(question);
    if (/^(xin chao|hello|hi|hey|chao ban|chao|alo)\b/.test(quickNorm)) {
      return { type: 'greeting' };
    }

    const systemInstruction = [
      'Bạn là chuyên gia NLP cho chatbot bất động sản Việt Nam.',
      'Phân tích tin nhắn người dùng, trích xuất ý định và thực thể.',
      'CHỈ trả về JSON hợp lệ, KHÔNG kèm giải thích hay markdown.',
      '',
      'Cấu trúc JSON:',
      '{',
      '  "type": "search_property" | "recommend_property" | "qa_real_estate" | "compare_property" | "booking" | "upgrade_account" | "upgrade_listing" | "greeting" | "investment_advice" | "market_analysis" | "financing_advice" | "unknown",',
      '  "minPrice": number | null,',
      '  "maxPrice": number | null,',
      '  "location": "string | null (tên địa điểm CÓ DẤU, viết hoa: Đà Nẵng, Quận 7, Hải Châu)",',
      '  "sourceType": "house" | "land" | null,',
      '  "requiredKeyword": "string | null (VD: mat tien, hem, bien, gara, vuon, ho boi, thang may, nha pho)",',
      '  "compareIds": [number] | null,',
      '  "compareDescriptions": ["string"] | null,',
      '  "transactionType": "sale" | "rent" | null,',
      '  "purpose": "invest" | "live" | "rent_out" | null,',
      '  "monthlyIncome": number | null,',
      '  "downPayment": number | null,',
      '  "expandedQuery": "string (câu query tối ưu cho tìm kiếm vector, tiếng Việt KHÔNG DẤU, chứa đầy đủ từ khóa BĐS liên quan)"',
      '}',
      '',
      'Quy tắc phân loại type:',
      '- greeting: Chào hỏi đơn giản',
      '- search_property: Tìm/mua/thuê BĐS cụ thể (có giá, vị trí, loại)',
      '- recommend_property: Nhờ gợi ý, đề xuất BĐS phù hợp',
      '- qa_real_estate: Hỏi kiến thức BĐS (sổ đỏ, pháp lý, thủ tục, kinh nghiệm)',
      '- market_analysis: Hỏi về thị trường, giá trung bình, xu hướng',
      '- financing_advice: Hỏi vay vốn, trả góp, lãi suất, khả năng tài chính',
      '- investment_advice: Hỏi đầu tư, sinh lời, chiến lược',
      '- compare_property: So sánh các BĐS với nhau',
      '- booking: Đặt lịch xem nhà/đất',
      '- upgrade_account: Nâng cấp tài khoản VIP',
      '- upgrade_listing: Đẩy tin, nâng cấp bài đăng',
      '',
      'Quy tắc giá tiền (chuyển sang VNĐ):',
      '- "1 tỷ 5" hoặc "1.5 tỷ" → 1500000000',
      '- "500 triệu" → 500000000',
      '- "dưới 3 tỷ" → maxPrice: 3000000000',
      '- "từ 2 đến 5 tỷ" → minPrice: 2000000000, maxPrice: 5000000000',
      '- "tầm 2 tỏi" hoặc "2 củ to" (tiếng lóng) → maxPrice: 2000000000',
      '',
      'Quy tắc expandedQuery:',
      '- Viết tiếng Việt KHÔNG DẤU, đầy đủ từ khóa BĐS',
      '- Mở rộng từ viết tắt/tiếng lóng thành từ chuẩn',
      '- VD: "có miếng nào cắm dùi 2 tỏi" → "dat nen gia re duoi 2 ty de o xay nha"',
      '- VD: "nhà HĐ dưới 3 tỷ" → "nha o hai chau da nang gia duoi 3 ty"',
    ].join('\n');

    try {
      const response = await AiUtils.generateLlmResponse(
        question,
        systemInstruction,
        {
          temperature: 0.05,
          isJson: true,
          maxTokens: 512,
          timeout: 8000,
        },
      );

      if (response) {
        const parsed = AiUtils.tryParseJson(response);
        if (parsed && parsed.type && typeof parsed.type === 'string') {
          // Clean null values from LLM output
          const intent: ParsedIntent = { type: parsed.type as any };
          if (parsed.minPrice && Number.isFinite(Number(parsed.minPrice)))
            intent.minPrice = Number(parsed.minPrice);
          if (parsed.maxPrice && Number.isFinite(Number(parsed.maxPrice)))
            intent.maxPrice = Number(parsed.maxPrice);
          if (parsed.location && typeof parsed.location === 'string') {
            intent.location = parsed.location as string;
            intent.locationTokens = AiUtils.normalizeText(intent.location)
              .split(/\s+/)
              .filter((t: string) => t.length >= 2);
          }
          if (parsed.sourceType === 'house' || parsed.sourceType === 'land')
            intent.sourceType = parsed.sourceType;
          if (parsed.requiredKeyword && typeof parsed.requiredKeyword === 'string')
            intent.requiredKeyword = parsed.requiredKeyword as string;
          if (Array.isArray(parsed.compareIds) && parsed.compareIds.length >= 2)
            intent.compareIds = parsed.compareIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0);
          if (Array.isArray(parsed.compareDescriptions) && parsed.compareDescriptions.length >= 2)
            intent.compareDescriptions = parsed.compareDescriptions as string[];
          if (parsed.transactionType === 'sale' || parsed.transactionType === 'rent')
            intent.transactionType = parsed.transactionType;
          if (parsed.purpose === 'invest' || parsed.purpose === 'live' || parsed.purpose === 'rent_out')
            intent.purpose = parsed.purpose;
          if (parsed.monthlyIncome && Number.isFinite(Number(parsed.monthlyIncome)))
            intent.monthlyIncome = Number(parsed.monthlyIncome);
          if (parsed.downPayment && Number.isFinite(Number(parsed.downPayment)))
            intent.downPayment = Number(parsed.downPayment);
          if (parsed.expandedQuery && typeof parsed.expandedQuery === 'string')
            intent.expandedQuery = parsed.expandedQuery as string;

          return intent;
        }
      }
    } catch (err) {
      // LLM failed — fall through to regex
    }

    // Fallback to deterministic regex parser
    return AiUtils.parseIntentRegex(question);
  }

  /**
   * Deterministic regex-based intent parser (fallback).
   * Kept as backup when LLM is unavailable or returns invalid data.
   */
  /**
   * parseIntentRegex — Fallback parser dùng regex thuần (deterministic).
   * Được gọi khi parseIntent() LLM fail hoặc trả về JSON không hợp lệ.
   *
   * THỨ TỰ Ư U TIÊN:
   *   1. greeting  → chào hỏi (ưu tiên cao nhất, trả sớm)
   *   2. compare   → so sánh (với ID hoặc description)
   *   3. booking   → đặt lịch xem nhà
   *   4. upgrade   → nâng cấp tài khoản / tin đăng
   *   5. financing → tư vấn tài chính
   *   6. investment→ tư vấn đầu tư
   *   7. market    → phân tích thị trường
   *   8. qa        → hỏi kiến thức pháp lý
   *   10. recommend→ gợi ý BDS
   *   11. search   → tìm kiếm BDS cụ thể
   *   12. unknown  → không xác định
   *
   * Sau khi xác định intent type, tiếp tục extract:
   *   - Giá: range (từ X đến Y), upper (dưới X), lower (trên X), exact, giá rẻ
   *   - Vị trí: 4-tier pattern matching (prefix, property+loc, admin unit, known list)
   *   - Loại BDS: house / land / post
   */
  static parseIntentRegex(question: string): ParsedIntent {
    const normalized = AiUtils.normalizeText(question);
    const intent: ParsedIntent = { type: 'unknown' };

    if (/^(xin chao|hello|hi|hey|chao ban|chao|alo)\b/.test(normalized)) {
      intent.type = 'greeting';
      return intent;
    }

    if (/\b(so sanh|compare|khac nhau|giong nhau)\b/.test(normalized)) {
      intent.type = 'compare_property';
      const explicitIdMatches = normalized.match(
        /\b(?:id|ma tin|ma|so|can|tin)\s*(\d+)\b/gi,
      );
      const largeNumbers = [...normalized.matchAll(/\b(\d{3,})\b/g)].map(
        (m: RegExpMatchArray) => m[1],
      );
      const allIds = [
        ...(explicitIdMatches ?? []).map((m) => m.replace(/\D/g, '')),
        ...largeNumbers,
      ]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      if (allIds.length >= 2) {
        intent.compareIds = [...new Set(allIds)].slice(0, 5);
      } else {
        const descParts = AiUtils.parseCompareDescriptions(question);
        if (descParts.length >= 2) {
          intent.compareDescriptions = descParts;
        }
      }
    } else if (
      /\b(so sanh|compare)\b.*\b(nha nay|cai nay|can nay|tin nay|nha do|cai do|can do|tin do|nha kia|cai kia|2 cai|hai cai|nhung cai|chung|vua tim|vua xem|tren|do|chung|nay voi|voi nhau)\b|\b(nha nay|cai nay|hai cai|2 cai|vua tim)\b.*\b(so sanh|compare|voi|va)\b/.test(
        normalized,
      )
    ) {
      intent.type = 'compare_property';
    } else if (
      /\b(dat lich|book|hen|xem nha|lich hen|lich xem)\b/.test(normalized)
    ) {
      intent.type = 'booking';
    } else if (
      /\b(nang cap|upgrade|vip|premium|pro)\b/.test(normalized) &&
      /\b(tai khoan|account)\b/.test(normalized)
    ) {
      intent.type = 'upgrade_account';
    } else if (
      /\b(nang cap|upgrade|vip|premium|day tin|tin noi bat)\b/.test(
        normalized,
      ) &&
      /\b(tin|listing|bai dang)\b/.test(normalized)
    ) {
      intent.type = 'upgrade_listing';
    } else if (
      /\b(vay mua|vay von|vay ngan|cho vay|khoan vay|di vay|can vay|muon vay|tra gop|lai suat|ngan hang|mortgage|kha nang tai chinh|kha nang vay|tra truoc)\b/.test(
        normalized,
      ) &&
      /\b(nha|dat|bds|bat dong san|mua|tra)\b/.test(normalized)
    ) {
      intent.type = 'financing_advice';
      // Extract income/price for financing
      const incomeMatch = normalized.match(
        /(?:thu nhap|luong)\s*(?:la|khoang|hang thang)?\s*([0-9.,]+)\s*(ty|trieu|tr)/,
      );
      if (incomeMatch) {
        intent.monthlyIncome = AiUtils.toVnd(incomeMatch[1], incomeMatch[2]);
      }
    } else if (
      /\b(dau tu|sinh loi|loi nhuan|roi|yield|chien luoc)\b/.test(normalized) &&
      /\b(nha|dat|bds|bat dong san|khu vuc|nen|o dau|nao)\b/.test(normalized) &&
      !/\b(la gi|nghia la)\b/.test(normalized) &&
      !/\b(tim|can mua|can thue|mua|dang tim|muon mua)\b/.test(normalized)
    ) {
      intent.type = 'investment_advice';
    } else if (
      /\b(thi truong|gia trung binh|xu huong|bien dong|phan tich|thong ke|bao nhieu|mat bang gia)\b/.test(
        normalized,
      ) &&
      /\b(nha|dat|bds|bat dong san|khu vuc|o|tai|hien nay|nam nay)\b/.test(
        normalized,
      ) &&
      !/\b(tim|can mua|can thue|mua)\b/.test(normalized)
    ) {
      intent.type = 'market_analysis';
    } else if (
      (/\b(la gi|nghia la|the nao|thu tuc|phap ly)\b/.test(normalized) ||
        (/\b(so hong|so do|cong chung|phi)\b/.test(normalized) &&
          /\b(la gi|nghia la|the nao|bao nhieu|nhu the nao)\b/.test(
            normalized,
          ))) &&
      !/\b(tim|can mua|can thue|gia bao nhieu)\b/.test(normalized)
    ) {
      intent.type = 'qa_real_estate';
    } else if (
      /\b(kinh nghiem|luu y|loi khuyen)\b/.test(normalized) &&
      (/\b(lan dau|mua nha lan dau)\b/.test(normalized) ||
        !/\b(tim|can mua|can thue|ty|trieu|can ho)\b/.test(normalized))
    ) {
      intent.type = 'qa_real_estate';
    } else if (
      /\b(nen mua|goi y|recommend|phu hop|nhu cau)\b/.test(normalized)
    ) {
      intent.type = 'recommend_property';
    } else if (
      /\b(tim kiem|can tim|dang tim|muon mua|muon thue|can mua|can thue|tim nha|tim dat|tim can ho|tim chung cu|tim)\b/.test(
        normalized,
      ) ||
      (/\b(nha|dat|can ho|chung cu)\b/.test(normalized) &&
        /\b(gia|ty|trieu|bao nhieu|duoi|tren|tam|khoang)\b/.test(normalized)) ||
      (/\b(nha|dat|can ho|chung cu)\b/.test(normalized) &&
        /\b(phong ngu|pn|tang|m2|met vuong|phong)\b/.test(normalized) &&
        /\b(o|tai|khu vuc|gan)\b/.test(normalized))
    ) {
      intent.type = 'search_property';
    }

    const rangeMatch = normalized.match(
      /tu\s+([0-9.,]+)\s*(ty|trieu|tr)?\s+(den|toi|-)\s+([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (rangeMatch) {
      const min = AiUtils.toVnd(rangeMatch[1], rangeMatch[2]);
      const max = AiUtils.toVnd(rangeMatch[4], rangeMatch[5]);
      if (min !== undefined && max !== undefined) {
        intent.minPrice = Math.min(min, max);
        intent.maxPrice = Math.max(min, max);
      }
    }

    const underMatch = normalized.match(
      /(duoi|nho hon|<|<=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (underMatch) {
      const max = AiUtils.toVnd(underMatch[2], underMatch[3]);
      if (max !== undefined) intent.maxPrice = max;
    }

    const overMatch = normalized.match(
      /(tren|lon hon|>|>=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (overMatch) {
      const min = AiUtils.toVnd(overMatch[2], overMatch[3]);
      if (min !== undefined) intent.minPrice = min;
    }

    if (intent.maxPrice === undefined && intent.minPrice === undefined) {
      const budgetMatch = normalized.match(
        /(?:co|ngan sach|khoang|tam|budget|voi)\s+([0-9.,]+)\s*(ty|trieu|tr)?/,
      );
      if (budgetMatch) {
        const budget = AiUtils.toVnd(budgetMatch[1], budgetMatch[2]);
        if (budget !== undefined) intent.maxPrice = budget;
      }
    }

    if (
      intent.maxPrice === undefined &&
      intent.minPrice === undefined &&
      /\b(gia re|re nhat|gia tot|binh dan|re|gia mem)\b/.test(normalized)
    ) {
      if (intent.sourceType === 'land') {
        intent.maxPrice = 1_000_000_000;
      } else {
        intent.maxPrice = 2_000_000_000;
      }
    }

    if (intent.maxPrice === undefined && intent.minPrice === undefined) {
      const bareMatch = normalized.match(/\b([0-9.,]+)\s*(ty|trieu|tr)\b/);
      if (bareMatch) {
        const price = AiUtils.toVnd(bareMatch[1], bareMatch[2]);
        if (price !== undefined) {
          if (
            /\b(tim|can|mua|co|ngan sach|nen mua|goi y|tu van)\b/.test(
              normalized,
            )
          ) {
            intent.maxPrice = price;
          }
        }
      }
    }

    if (
      intent.type === 'unknown' &&
      (intent.minPrice !== undefined || intent.maxPrice !== undefined)
    ) {
      intent.type = 'search_property';
    }

    const locationMatch = normalized.match(
      /\b(?:o|tai|khu vuc|gan)\s+([a-z0-9\s]+?)(?:\s+(?:duoi|tren|gia|tu|den|co|nho|lon|voi|hien nay|nam nay)\b|\s*$)/,
    );
    if (locationMatch) {
      const location = locationMatch[1].trim();
      const stopWords = [
        'day',
        'do',
        'day do',
        'nay',
        'kia',
        'dau',
        'nao',
        'truong',
        'benh vien',
        'cho',
        'sieu thi',
        'hien nay',
        'nam nay',
        'minh',
        'minh mua nha',
        'ban',
        'anh',
        'chi',
      ];
      if (location.length >= 4 && !stopWords.includes(location)) {
        intent.location = location;
      } else if (location === 'hue' || /\d/.test(location)) {
        // explicitly allow known short locations or locations with numbers (e.g. q1)
        intent.location = location;
      }
    }

    // Secondary pattern: extract location after property type words without
    // requiring a prefix like "ở/tại". Handles "nhà Hải Châu dưới 3 tỷ",
    // "đất Hoà Vang giá rẻ", etc.
    if (!intent.location) {
      const propertyLocMatch = normalized.match(
        /\b(?:nha|dat|can ho|chung cu|bds|bat dong san)\s+([a-z]{2,}(?:\s+[a-z]{2,}){0,3}?)(?:\s+(?:duoi|tren|gia|tu|den|co|nho|lon|re|tam|khoang|[0-9])|$)/,
      );
      if (propertyLocMatch) {
        const candidate = propertyLocMatch[1].trim();
        const nonLocationWords = new Set([
          'nen', 'pho', 'dep', 'tot', 'moi', 'cu', 'lon', 'nho',
          'sang', 'trong', 'rong', 'cao', 'thap', 'vua', 'binh',
          'mat', 'tien', 'hem', 'ngo', 'cho', 'thue', 'ban',
        ]);
        if (candidate.length >= 4 && !nonLocationWords.has(candidate)) {
          intent.location = candidate;
        }
      }
    }

    // Tertiary pattern: "quận/huyện/phường X" without prefix
    if (!intent.location) {
      const adminMatch = normalized.match(
        /\b(quan|huyen|phuong|thi xa|thi tran)\s+([a-z0-9]+(?:\s+[a-z]+){0,2})/,
      );
      if (adminMatch) {
        intent.location = `${adminMatch[1]} ${adminMatch[2]}`.trim();
      }
    }

    if (!intent.location) {
      const knownLocations = [
        'lien chieu',
        'son tra',
        'hai chau',
        'thanh khe',
        'cam le',
        'ngu hanh son',
        'hoa vang',
        'da nang',
        'ha noi',
        'ho chi minh',
        'binh duong',
        'dong nai',
        'can tho',
        'hai phong',
        'nha trang',
        'hue',
        'vung tau',
        'quang nam',
        'binh dinh',
        'khanh hoa',
        'da lat',
        'lam dong',
        'phu yen',
        'quang ngai',
        'binh thanh',
        'tan binh',
        'thu duc',
        'go vap',
        'phu nhuan',
        'quan 1',
        'quan 2',
        'quan 3',
        'quan 5',
        'quan 7',
        'quan 9',
        'quan 10',
        'quan 12',
        'tan phu',
        'binh tan',
      ];
      for (const loc of knownLocations) {
        if (normalized.includes(loc)) {
          intent.location = loc;
          break;
        }
      }
    }

    // Map normalized location back to Vietnamese display name with diacritics
    const LOCATION_DISPLAY: Record<string, string> = {
      'da nang': 'Đà Nẵng',
      'ha noi': 'Hà Nội',
      'ho chi minh': 'Hồ Chí Minh',
      'binh duong': 'Bình Dương',
      'dong nai': 'Đồng Nai',
      'can tho': 'Cần Thơ',
      'hai phong': 'Hải Phòng',
      'nha trang': 'Nha Trang',
      hue: 'Huế',
      'vung tau': 'Vũng Tàu',
      'quang nam': 'Quảng Nam',
      'binh dinh': 'Bình Định',
      'khanh hoa': 'Khánh Hòa',
      'da lat': 'Đà Lạt',
      'lam dong': 'Lâm Đồng',
      'phu yen': 'Phú Yên',
      'quang ngai': 'Quảng Ngãi',
      'hai chau': 'Hải Châu',
      'lien chieu': 'Liên Chiểu',
      'son tra': 'Sơn Trà',
      'ngu hanh son': 'Ngũ Hành Sơn',
      'thanh khe': 'Thanh Khê',
      'cam le': 'Cẩm Lệ',
      'hoa vang': 'Hoà Vang',
      'binh thanh': 'Bình Thạnh',
      'tan binh': 'Tân Bình',
      'thu duc': 'Thủ Đức',
      'go vap': 'Gò Vấp',
      'phu nhuan': 'Phú Nhuận',
      'tan phu': 'Tân Phú',
      'binh tan': 'Bình Tân',
      'quan 1': 'Quận 1',
      'quan 2': 'Quận 2',
      'quan 3': 'Quận 3',
      'quan 5': 'Quận 5',
      'quan 7': 'Quận 7',
      'quan 9': 'Quận 9',
      'quan 10': 'Quận 10',
      'quan 12': 'Quận 12',
    };
    if (intent.location && LOCATION_DISPLAY[intent.location]) {
      intent.location = LOCATION_DISPLAY[intent.location];
    }

    if (intent.location) {
      intent.locationTokens = intent.location
        .split(/\s+/)
        .filter((t) => t.length >= 2);
    }

    if (/\b(chung cu|can ho|apartment)\b/.test(normalized)) {
      intent.sourceType = 'house';
    } else if (/\b(nha|biet thu|townhouse)\b/.test(normalized)) {
      intent.sourceType = 'house';
    } else if (/\b(dat|nen)\b/.test(normalized)) {
      intent.sourceType = 'land';
    }

    if (/\b(nong nghiep|vuon|trong cay)\b/.test(normalized)) {
      intent.sourceType = 'land';
    }

    // Purpose detection
    if (/\b(dau tu|sinh loi|loi nhuan)\b/.test(normalized)) {
      intent.purpose = 'invest';
    } else if (
      /\b(cho thue lai|thue lai|thu nhap thu dong)\b/.test(normalized)
    ) {
      intent.purpose = 'rent_out';
    } else if (/\b(de o|o lau dai|an cu|dinh cu)\b/.test(normalized)) {
      intent.purpose = 'live';
    }

    const requiredKeywordMap: Array<[RegExp, string]> = [
      [/\b(mat tien|mat duong|truoc mat|thoang mat|lo goc)\b/, 'mat tien'],
      [/\b(hem ngo|hem xe|hem|ngo)\b/, 'hem'],
      [/\b(view bien|nhin bien|gan bien|ven bien)\b/, 'bien'],
      [/\b(gara|garage|san xe o to)\b/, 'gara'],
      [/\b(san vuon|co vuon|vuon rau)\b/, 'vuon'],
      [/\b(ho boi|boi loi)\b/, 'ho boi'],
      [/\b(thang may|elevator)\b/, 'thang may'],
      [/\b(nha pho|lien ke)\b/, 'nha pho'],
    ];
    for (const [pattern, kw] of requiredKeywordMap) {
      if (pattern.test(normalized)) {
        intent.requiredKeyword = kw;
        break;
      }
    }

    if (
      /\b(cho thue|thue|rent|thang)\b/.test(normalized) &&
      !/\b(thu tuc|quy trinh|kinh nghiem)\b/.test(normalized)
    ) {
      intent.transactionType = 'rent';
    } else if (/\b(mua|de ban|rao ban)\b/.test(normalized)) {
      intent.transactionType = 'sale';
    }

    return intent;
  }

  // ─── BM25 Sparse Vector ──────────────────────────────────────────

  /**
   * Vietnamese stopwords to exclude from BM25 tokenization.
   * Keeps the sparse vector focused on meaningful content words.
   */
  private static readonly VI_STOPWORDS = new Set([
    'va', 'cua', 'la', 'co', 'o', 'tai', 'cho', 'trong', 'ngoai',
    'voi', 'tu', 'den', 'ma', 'thi', 'nhung', 'cac', 'mot', 'nhu',
    'se', 'da', 'dang', 'duoc', 'boi', 'vi', 'nen', 'hay', 'hoac',
    'khi', 'nay', 'do', 'no', 'cung', 'nao', 'rat', 'roi', 'tren',
    'duoi', 'sau', 'truoc', 'day', 'the', 'gi', 'de', 'vay', 'thi',
    'minh', 'ban', 'anh', 'chi', 'em', 'bao', 'nhieu', 'sao',
    'dau', 'rong', 'nho', 'lon', 'cao', 'thap', 'moi', 'cu',
  ]);

  /**
   * Build a BM25-style sparse vector from Vietnamese text.
   * Returns an object with `indices` and `values` arrays for Qdrant sparse vector.
   *
   * Uses simple term-frequency (TF) weighting with Vietnamese stopword removal.
   * Token IDs are generated via a stable hash function for consistency.
   */
  static buildBm25SparseVector(text: string): {
    indices: number[];
    values: number[];
  } {
    const normalized = AiUtils.normalizeText(text);
    const tokens = normalized
      .split(/\s+/)
      .filter(
        (t) => t.length >= 2 && !AiUtils.VI_STOPWORDS.has(t) && !/^\d+$/.test(t),
      );

    if (tokens.length === 0) return { indices: [], values: [] };

    // Count term frequencies
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Convert tokens to stable numeric IDs using a simple hash
    const entries: Array<{ index: number; value: number }> = [];
    for (const [term, count] of tf) {
      const hash = AiUtils.stableHash(term);
      // BM25-inspired TF saturation: tf / (tf + 1.2)
      const weight = count / (count + 1.2);
      entries.push({ index: hash, value: weight });
    }

    // Sort by index for Qdrant requirement
    entries.sort((a, b) => a.index - b.index);

    return {
      indices: entries.map((e) => e.index),
      values: entries.map((e) => e.value),
    };
  }

  /**
   * Stable 32-bit hash for a string token.
   * Returns a non-negative integer suitable for sparse vector indices.
   */
  private static stableHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % 1_000_000; // Keep within reasonable range
  }

  static buildIntentInstructions(intent: ParsedIntent): string {
    const purposeLabel =
      intent.purpose === 'invest'
        ? 'đầu tư'
        : intent.purpose === 'rent_out'
          ? 'cho thuê lại'
          : intent.purpose === 'live'
            ? 'để ở'
            : '';

    switch (intent.type) {
      case 'search_property':
        return [
          'NHIỆM VỤ: Tìm kiếm BĐS CHÍNH XÁC theo yêu cầu người dùng.',
          'QUAN TRỌNG: Chỉ gợi ý BĐS mà GIÁ NẰM TRONG ngân sách. Nếu giá > ngân sách thì LOẠI BỎ.',
          intent.maxPrice
            ? `NGÂN SÁCH TỐI ĐA: ${AiUtils.formatVnd(intent.maxPrice)}. TUYỆT ĐỐI không gợi ý BĐS có giá vượt ngân sách này.`
            : '',
          intent.minPrice
            ? `GIÁ TỐI THIỂU: ${AiUtils.formatVnd(intent.minPrice)}.`
            : '',
          intent.sourceType
            ? `LOẠI BĐS yêu cầu: ${intent.sourceType === 'house' ? 'NHÀ (house)' : intent.sourceType === 'land' ? 'ĐẤT (land)' : intent.sourceType}. Chỉ gợi ý đúng loại này.`
            : '',
          intent.location
            ? `KHU VỰC: ${intent.location}. Ưu tiên BĐS ở khu vực này.`
            : '',
          purposeLabel
            ? `MỤC ĐÍCH: ${purposeLabel}. Đánh giá BĐS theo mục đích này.`
            : '',
          'Mỗi gợi ý PHẢI có reason giải thích tại sao giá phù hợp, diện tích hợp lý, vị trí thuận lợi.',
        ]
          .filter(Boolean)
          .join('\n');

      case 'recommend_property':
        return [
          'NHIỆM VỤ: Tư vấn và gợi ý BĐS phù hợp NHẤT với nhu cầu.',
          'Phân tích kỹ: ngân sách, vị trí, diện tích, tiện ích.',
          'QUAN TRỌNG: Nếu người dùng có ngân sách, chỉ gợi ý BĐS TRONG ngân sách.',
          'Giải thích CHI TIẾT lý do gợi ý.',
          'Nếu thiếu thông tin, đặt câu hỏi làm rõ trong followUp.',
          purposeLabel
            ? `Mục đích người dùng: ${purposeLabel}. Ưu tiên gợi ý phù hợp mục đích.`
            : '',
          intent.maxPrice
            ? `Ngân sách: ${AiUtils.formatVnd(intent.maxPrice)}. Không gợi ý BĐS vượt ngân sách.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      case 'compare_property':
        return [
          'NHIỆM VỤ: So sánh các BĐS trong CONTEXT.',
          'QUAN TRỌNG: Chỉ so sánh BĐS CÙNG LOẠI (nhà với nhà, đất với đất) và ƯU TIÊN cùng khu vực.',
          'So sánh theo: giá, giá/m2, diện tích, vị trí, số phòng ngủ, ưu/nhược điểm.',
          'Kết luận: BĐS nào phù hợp nhất và TẠI SAO.',
        ].join('\n');

      case 'investment_advice':
        return [
          'NHIỆM VỤ: Tư vấn đầu tư BĐS chuyên sâu.',
          'Phân tích: tiềm năng tăng giá, thanh khoản, ROI, rủi ro khu vực.',
          'Đề xuất chiến lược: mua bán, cho thuê, giữ dài hạn.',
          'Nếu có dữ liệu CONTEXT, phân tích cụ thể từng BĐS cho mục đích đầu tư.',
          intent.maxPrice
            ? `Ngân sách đầu tư: ${AiUtils.formatVnd(intent.maxPrice)}.`
            : '',
          intent.location ? `Khu vực quan tâm: ${intent.location}.` : '',
        ]
          .filter(Boolean)
          .join('\n');

      case 'market_analysis':
        return [
          'NHIỆM VỤ: Phân tích thị trường BĐS.',
          'Cung cấp: mức giá trung bình, xu hướng, phân khúc phổ biến.',
          'Dựa trên dữ liệu CONTEXT nếu có, nếu không thì cung cấp nhận định chung.',
          intent.location ? `Khu vực phân tích: ${intent.location}.` : '',
        ]
          .filter(Boolean)
          .join('\n');

      case 'financing_advice':
        return [
          'NHIỆM VỤ: Tư vấn tài chính mua BĐS.',
          'Tính toán: khả năng vay, trả góp, lãi suất tham khảo.',
          'Đề xuất phương án tài chính phù hợp.',
          intent.monthlyIncome
            ? `Thu nhập hàng tháng: ${AiUtils.formatVnd(intent.monthlyIncome)}.`
            : '',
          intent.maxPrice
            ? `Giá BĐS mục tiêu: ${AiUtils.formatVnd(intent.maxPrice)}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      default:
        return 'NHIỆM VỤ: Trả lời câu hỏi về BĐS. Nếu có BĐS phù hợp trong CONTEXT, gợi ý kèm lý do cụ thể.';
    }
  }

  static hasPropertyDetails(question: string): boolean {
    if (question.trim().length > 100) return true;

    const normalized = AiUtils.normalizeText(question);

    const hasLocation =
      /\b(quan|huyen|phuong|xa|duong|tinh|tp|thanh pho|ha noi|ho chi minh|da nang|binh duong|dong nai|vung tau|hue|can tho|nha trang)\b/.test(
        normalized,
      );
    const hasArea = /\b(\d+\s*m2|\d+\s*m²|\d+\s*met vuong|dien tich)\b/.test(
      normalized,
    );
    const hasPrice = /\b\d+(\.\d+)?\s*(ty|trieu|tr)\b/.test(normalized);
    const hasRooms =
      /\b(\d+\s*(phong ngu|pn|phong|tang)|so phong|so tang)\b/.test(normalized);
    const hasPropertyType =
      /\b(nha pho|can ho|biet thu|dat nen|chung cu|shophouse|nha cap 4)\b/.test(
        normalized,
      );

    const detailCount = [
      hasLocation,
      hasArea,
      hasPrice,
      hasRooms,
      hasPropertyType,
    ].filter(Boolean).length;
    return detailCount >= 2;
  }

  static tryParseJson(raw: string): Record<string, unknown> | null {
    let cleaned = raw.trim();

    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object')
        return parsed as Record<string, unknown>;
    } catch {
      // fall through to extraction
    }

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        const sliced = cleaned.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(sliced);
        if (parsed && typeof parsed === 'object')
          return parsed as Record<string, unknown>;
      } catch {
        // fall through
      }
    }

    return null;
  }
  static normalizeDetailUrl(
    url: unknown,
    source: unknown,
    sourceId: unknown,
  ): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const src = String(source || '').toLowerCase();
    const id = Number(sourceId);
    const sourceRoute: Record<string, string> = {
      house: 'houses',
      land: 'lands',
      post: 'posts',
    };

    if (Number.isFinite(id) && id > 0 && sourceRoute[src]) {
      return `${frontendUrl}/${sourceRoute[src]}/${id}`;
    }

    const rawUrl = String(url || '').trim();
    if (!rawUrl) return '';

    const apiMatch = rawUrl.match(/\/api\/(houses|lands|posts)\/(\d+)/i);
    if (apiMatch) {
      return `${frontendUrl}/${apiMatch[1].toLowerCase()}/${apiMatch[2]}`;
    }
    return rawUrl;
  }

  static formatSuggestionBlock(index: number, item: any): string {
    const title = String(item.title || 'N/A');
    const location = String(item.location || 'N/A');
    const price = AiUtils.formatVnd(item.price);
    const area = AiUtils.formatArea(item.area);
    const url = AiUtils.normalizeDetailUrl(
      item.url,
      item.source,
      item.sourceId,
    );
    const reason = String(item.reason || '').trim();
    const bedrooms = Number(item.bedrooms ?? 0);
    const floors = Number(item.floors ?? 0);
    const direction = String(item.direction || '').trim();

    const sourceId = Number(item.sourceId);
    const sourceLabel = String(item.source || '').toUpperCase();
    const hasDetail = Number.isFinite(sourceId) && sourceId > 0;

    const lines: string[] = [];
    lines.push(`${index}. ${sourceLabel ? `${sourceLabel} ` : ''}${title}`);
    lines.push(`   - ${location}`);
    lines.push(`   - Giá: ${price}`);
    lines.push(`   - Diện tích: ${area}`);
    if (bedrooms > 0) lines.push(`   - Phòng ngủ: ${bedrooms} phòng`);
    if (floors > 0) lines.push(`   - Số tầng: ${floors}`);
    if (direction) lines.push(`   - Hướng: ${direction}`);
    if (reason) lines.push(`   - Lý do: ${reason}`);
    if (url && hasDetail) lines.push(`   - Xem chi tiết: ${url}`);

    return lines.join('\n');
  }

  static toFastAnswer(hits: VectorHit[], intent?: ParsedIntent): string {
    let filtered = hits;
    if (intent?.maxPrice) {
      filtered = hits.filter(
        (h) => Number(h.payload?.price ?? 0) <= intent.maxPrice!,
      );
      if (filtered.length === 0) filtered = hits.slice(0, 1);
    }
    const recs = filtered.slice(0, 3).map((h) => h.payload || {});
    if (recs.length === 0) {
      return 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';
    }

    const lines: string[] = [];
    lines.push(`Mình tìm thấy **${recs.length} gợi ý** phù hợp nhất:`);
    lines.push('');

    recs.forEach((r, idx) => {
      const title = String(r.title || 'BĐS').trim();
      const price = AiUtils.formatVnd(r.price);
      const area = AiUtils.formatArea(r.area);
      const url = AiUtils.normalizeDetailUrl(r.url, r.source, r.sourceId);

      const typeStr =
        String(r.source) === 'land'
          ? 'lô đất'
          : String(r.source) === 'house'
            ? 'căn nhà'
            : 'bất động sản';
      const loc = [r.district, r.city].filter(Boolean).join(', ');

      let dynamicReason = `Gợi ý ${typeStr} tiềm năng`;
      if (loc) dynamicReason += ` khu vực ${loc}`;
      dynamicReason += `, không gian ${area}`;
      if (Number(r.bedrooms) > 0)
        dynamicReason += ` cùng thiết kế ${r.bedrooms} phòng ngủ`;
      dynamicReason += `, một lựa chọn đáng giá để cân nhắc.`;

      let line = `${idx + 1}. **${title}** — ${price} • ${area}`;
      line += `\n   💡 _Tóm tắt: ${dynamicReason}_`;
      lines.push(line);
    });

    lines.push('');
    lines.push('Bạn muốn xem chi tiết căn nào hoặc lọc kỹ hơn không?');

    return lines.join('\n').trim();
  }

  static toDisplayAnswer(structured: Record<string, unknown>): string {
    const summary = String(structured.summary || '').trim();
    const recs = Array.isArray(structured.recommendations)
      ? (structured.recommendations as Array<Record<string, unknown>>)
      : [];
    const followUp = String(structured.followUp || '').trim();
    const trimReason = (text: string, maxLen = 160): string => {
      const clean = text.trim();
      if (clean.length <= maxLen) return clean;
      return `${clean.slice(0, Math.max(0, maxLen - 3))}...`;
    };

    const lines: string[] = [];
    if (summary) lines.push(summary);

    if (recs.length > 0) {
      lines.push('');
      recs.slice(0, 3).forEach((r, idx) => {
        const title = String(r.title || '').trim();
        const reason = trimReason(String(r.reason || ''));
        const price = AiUtils.formatVnd(r.price);
        const area = AiUtils.formatArea(r.area);
        const url = AiUtils.normalizeDetailUrl(r.url, r.source, r.sourceId);

        let line = `${idx + 1}. **${title}** — ${price} • ${area}`;
        if (reason) line += `\n   💡 _Tóm tắt: ${reason}_`;
        lines.push(line);
      });
    }

    if (followUp) {
      lines.push('');
      lines.push(followUp);
    }

    const result = lines.join('\n').trim();
    if (!result) {
      return summary || 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp.';
    }
    return result;
  }
}
