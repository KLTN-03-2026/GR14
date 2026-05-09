import { ParsedIntent, VectorHit } from '../types/ai.types';

export class AiUtils {
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

  static toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const num = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  static toVnd(amountText: string, unit?: string): number | undefined {
    const amount = Number(String(amountText).replace(/,/g, '.'));
    if (!Number.isFinite(amount)) return undefined;

    const normalizedUnit = (unit || '').toLowerCase();
    if (normalizedUnit === 'ty') return amount * 1_000_000_000;
    if (normalizedUnit === 'trieu' || normalizedUnit === 'tr')
      return amount * 1_000_000;

    return undefined;
  }

  static formatVnd(value: unknown): string {
    const amount = AiUtils.toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} VNĐ`;
  }

  static formatArea(value: unknown): string {
    const area = AiUtils.toNumber(value);
    if (!Number.isFinite(area) || area <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(area)} m²`;
  }

  static stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  static compactMemoryText(value: string, limit: number): string {
    const oneLine = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (oneLine.length <= limit) return oneLine;
    return `${oneLine.slice(0, Math.max(0, limit - 3))}...`;
  }

  static async generateLlmResponse(
    promptOrContents: string | any[],
    systemInstruction: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
      isJson?: boolean;
    } = {}
  ): Promise<string | null> {
    const axios = require('axios');
    
    // Parse multiple Gemini keys separated by commas
    const rawGeminiKeys = process.env.GEMINI_API_KEY || '';
    const geminiApiKeys = rawGeminiKeys.split(',').map((k: string) => k.trim()).filter(Boolean);
    
    const geminiModel = process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
    const geminiApiBase = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    
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

    // 1. Try Gemini Keys sequentially if rate-limited
    for (const apiKey of geminiApiKeys) {
      try {
        const resp = await axios.post(
          `${geminiApiBase}/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: contents,
            generationConfig: generationConfig,
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          },
          { timeout }
        );
        const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = resp.data?.candidates?.[0]?.finishReason;
        
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
           console.warn(`[LLM] Gemini blocked by safety filters. Key: ${apiKey.substring(0, 8)}...`);
           continue; // Maybe next key won't be blocked, but unlikely. Let's still fallback.
        }
        
        if (text) return text;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429) {
          console.warn(`[LLM] Gemini Rate Limit Hit for key starting with ${apiKey.substring(0, 8)}... Trying next key...`);
          continue; // Try next key
        } else {
          console.warn(`[LLM] Gemini failed with status ${status}: ${AiUtils.stringifyError(err)}. Moving to next fallback...`);
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
               messages.unshift({ role: 'system', content: 'Please format the output as JSON' });
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
          }
        );
        const text = resp.data?.choices?.[0]?.message?.content || '';
        if (text) return text;
      } catch (err: any) {
        console.error(`[LLM] Groq fallback failed: ${AiUtils.stringifyError(err)}`);
      }
    }

    // 3. Fallback to OpenRouter if Groq also failed
    if (openRouterApiKey) {
      console.log(`[LLM] Falling back to OpenRouter API using model ${openRouterModel}...`);
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
              'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000', 
              'X-Title': 'BlacksCity Bot',
            },
            timeout,
          }
        );
        const text = resp.data?.choices?.[0]?.message?.content || '';
        if (text) return text;
      } catch (err: any) {
        console.error(`[LLM] OpenRouter fallback failed: ${AiUtils.stringifyError(err)}`);
      }
    }

    return null;
  }

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
    const tyRegex = /(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty)\s*(?:(\d+)\s*(?:triệu|trieu|tr))?/gi;
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

  static parseCompareDescriptions(question: string): string[] {
    let stripped = question
      .replace(
        /^(so\s+s[aá]nh|compare|so\s+v[oớ]i|h[aã]y\s+so\s+s[aá]nh)\s*/i,
        '',
      )
      .trim();

    const splitRegex = /\s+(?:so\s+s[aá]nh\s+v[oớ]i|v[oớ]i|và|vs|or|hoặc|so\s+s[aá]nh)\s+/i;
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

  static parseIntent(question: string): ParsedIntent {
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
      /\b(vay|tra gop|lai suat|ngan hang|mortgage|kha nang tai chinh|kha nang vay|tra truoc)\b/.test(normalized) &&
      /\b(nha|dat|bds|bat dong san|mua|vay|tra)\b/.test(normalized)
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
      /\b(thi truong|gia trung binh|xu huong|bien dong|phan tich|thong ke|bao nhieu|mat bang gia)\b/.test(normalized) &&
      /\b(nha|dat|bds|bat dong san|khu vuc|o|tai|hien nay|nam nay)\b/.test(normalized) &&
      !/\b(tim|can mua|can thue|mua)\b/.test(normalized)
    ) {
      intent.type = 'market_analysis';
    } else if (
      (/\b(la gi|nghia la|the nao|thu tuc|phap ly)\b/.test(normalized) ||
        (/\b(so hong|so do|cong chung|phi)\b/.test(normalized) && /\b(la gi|nghia la|the nao|bao nhieu|nhu the nao)\b/.test(normalized))) &&
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
      /\b(tu van cho minh|giup minh chon|huong dan mua|nen mua gi|mua nha nao|giup minh tim|ban tu van|muon duoc tu van|can tu van)\b/.test(normalized)
    ) {
      intent.type = 'consultation';
    } else if (
      /\b(nen mua|goi y|recommend|phu hop|nhu cau)\b/.test(normalized)
    ) {
      intent.type = 'recommend_property';
    } else if (
      /\b(tim kiem|can tim|dang tim|muon mua|muon thue|can mua|can thue|tim nha|tim dat|tim can ho|tim chung cu|tim)\b/.test(normalized) ||
      (/\b(nha|dat|can ho|chung cu)\b/.test(normalized) && /\b(gia|ty|trieu|bao nhieu|duoi|tren|tam|khoang)\b/.test(normalized)) ||
      (/\b(nha|dat|can ho|chung cu)\b/.test(normalized) && /\b(phong ngu|pn|tang|m2|met vuong|phong)\b/.test(normalized) && /\b(o|tai|khu vuc|gan)\b/.test(normalized))
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
      const stopWords = ['day', 'do', 'day do', 'nay', 'kia', 'dau', 'nao', 'truong', 'benh vien', 'cho', 'sieu thi', 'hien nay', 'nam nay', 'minh', 'minh mua nha', 'ban', 'anh', 'chi'];
      if (location.length >= 4 && !stopWords.includes(location)) {
        intent.location = location;
      } else if (location === 'hue' || /\d/.test(location)) {
        // explicitly allow known short locations or locations with numbers (e.g. q1)
        intent.location = location;
      }
    }

    if (!intent.location) {
      const knownLocations = [
        'lien chieu', 'son tra', 'hai chau', 'thanh khe', 'cam le',
        'ngu hanh son', 'hoa vang', 'da nang', 'ha noi', 'ho chi minh',
        'binh duong', 'dong nai', 'can tho', 'hai phong', 'nha trang',
        'hue', 'vung tau', 'quang nam', 'binh dinh', 'khanh hoa',
        'da lat', 'lam dong', 'phu yen', 'quang ngai', 'binh thanh',
        'tan binh', 'thu duc', 'go vap', 'phu nhuan', 'quan 1',
        'quan 2', 'quan 3', 'quan 5', 'quan 7', 'quan 9', 'quan 10',
        'quan 12', 'tan phu', 'binh tan',
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
      'da nang': 'Đà Nẵng', 'ha noi': 'Hà Nội', 'ho chi minh': 'Hồ Chí Minh',
      'binh duong': 'Bình Dương', 'dong nai': 'Đồng Nai', 'can tho': 'Cần Thơ',
      'hai phong': 'Hải Phòng', 'nha trang': 'Nha Trang', 'hue': 'Huế',
      'vung tau': 'Vũng Tàu', 'quang nam': 'Quảng Nam', 'binh dinh': 'Bình Định',
      'khanh hoa': 'Khánh Hòa', 'da lat': 'Đà Lạt', 'lam dong': 'Lâm Đồng',
      'phu yen': 'Phú Yên', 'quang ngai': 'Quảng Ngãi',
      'hai chau': 'Hải Châu', 'lien chieu': 'Liên Chiểu', 'son tra': 'Sơn Trà',
      'ngu hanh son': 'Ngũ Hành Sơn', 'thanh khe': 'Thanh Khê', 'cam le': 'Cẩm Lệ',
      'hoa vang': 'Hoà Vang', 'binh thanh': 'Bình Thạnh', 'tan binh': 'Tân Bình',
      'thu duc': 'Thủ Đức', 'go vap': 'Gò Vấp', 'phu nhuan': 'Phú Nhuận',
      'tan phu': 'Tân Phú', 'binh tan': 'Bình Tân',
      'quan 1': 'Quận 1', 'quan 2': 'Quận 2', 'quan 3': 'Quận 3',
      'quan 5': 'Quận 5', 'quan 7': 'Quận 7', 'quan 9': 'Quận 9',
      'quan 10': 'Quận 10', 'quan 12': 'Quận 12',
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
    } else if (/\b(cho thue lai|thue lai|thu nhap thu dong)\b/.test(normalized)) {
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

  static buildIntentInstructions(intent: ParsedIntent): string {
    const purposeLabel = intent.purpose === 'invest' ? 'đầu tư'
      : intent.purpose === 'rent_out' ? 'cho thuê lại'
        : intent.purpose === 'live' ? 'để ở' : '';

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
          intent.location ? `KHU VỰC: ${intent.location}. Ưu tiên BĐS ở khu vực này.` : '',
          purposeLabel ? `MỤC ĐÍCH: ${purposeLabel}. Đánh giá BĐS theo mục đích này.` : '',
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
          purposeLabel ? `Mục đích người dùng: ${purposeLabel}. Ưu tiên gợi ý phù hợp mục đích.` : '',
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
          intent.maxPrice ? `Ngân sách đầu tư: ${AiUtils.formatVnd(intent.maxPrice)}.` : '',
          intent.location ? `Khu vực quan tâm: ${intent.location}.` : '',
        ].filter(Boolean).join('\n');

      case 'market_analysis':
        return [
          'NHIỆM VỤ: Phân tích thị trường BĐS.',
          'Cung cấp: mức giá trung bình, xu hướng, phân khúc phổ biến.',
          'Dựa trên dữ liệu CONTEXT nếu có, nếu không thì cung cấp nhận định chung.',
          intent.location ? `Khu vực phân tích: ${intent.location}.` : '',
        ].filter(Boolean).join('\n');

      case 'financing_advice':
        return [
          'NHIỆM VỤ: Tư vấn tài chính mua BĐS.',
          'Tính toán: khả năng vay, trả góp, lãi suất tham khảo.',
          'Đề xuất phương án tài chính phù hợp.',
          intent.monthlyIncome ? `Thu nhập hàng tháng: ${AiUtils.formatVnd(intent.monthlyIncome)}.` : '',
          intent.maxPrice ? `Giá BĐS mục tiêu: ${AiUtils.formatVnd(intent.maxPrice)}.` : '',
        ].filter(Boolean).join('\n');

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
  static normalizeDetailUrl(url: unknown, source: unknown, sourceId: unknown): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const src = String(source || '').toLowerCase();
    const id = Number(sourceId);
    const sourceRoute: Record<string, string> = { house: 'houses', land: 'lands', post: 'posts' };

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
    const url = AiUtils.normalizeDetailUrl(item.url, item.source, item.sourceId);
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
      filtered = hits.filter(h => Number(h.payload?.price ?? 0) <= intent.maxPrice!);
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

      const typeStr = String(r.source) === 'land' ? 'lô đất' : String(r.source) === 'house' ? 'căn nhà' : 'bất động sản';
      const loc = [r.district, r.city].filter(Boolean).join(', ');

      let dynamicReason = `Gợi ý ${typeStr} tiềm năng`;
      if (loc) dynamicReason += ` khu vực ${loc}`;
      dynamicReason += `, không gian ${area}`;
      if (Number(r.bedrooms) > 0) dynamicReason += ` cùng thiết kế ${r.bedrooms} phòng ngủ`;
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
