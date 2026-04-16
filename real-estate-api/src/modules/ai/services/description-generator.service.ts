import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';

type ConversationState = {
  memoryKey: string;
  summaryKey: string;
  memory: Array<{ role: 'user' | 'assistant'; text: string; at: string }>;
  summaryMemory: string;
};

type PostTypeIntent = {
  label: string;
  objective: string;
  requiredSections: string;
  extraRules: string[];
};

@Injectable()
export class DescriptionGeneratorService {
  private readonly logger = new Logger(DescriptionGeneratorService.name);

  private readonly llmProvider = String(
    process.env.LLM_PROVIDER || '',
  ).toLowerCase();

  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly geminiApiUrl =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta';
  private readonly geminiModelPrimary =
    process.env.GEMINI_MODEL_PRIMARY || 'gemini-1.5-flash';
  private readonly geminiModelFallback1 =
    process.env.GEMINI_MODEL_FALLBACK_1 || 'gemini-1.5-pro';
  private readonly geminiModelFallback2 =
    process.env.GEMINI_MODEL_FALLBACK_2 || 'gemini-1.5-flash-8b';
  private readonly geminiTimeoutMs = Number(
    process.env.GEMINI_TIMEOUT_MS || 15000,
  );
  private readonly geminiMaxRetries = Number(
    process.env.GEMINI_MAX_RETRIES || 2,
  );
  private readonly geminiRetryBaseMs = Number(
    process.env.GEMINI_RETRY_BASE_MS || 1200,
  );
  private readonly geminiThinkingBudget = Number(
    process.env.GEMINI_THINKING_BUDGET || 0,
  );

  private readonly postTypeIntentMap: Record<string, PostTypeIntent> = {
    SELL_HOUSE: {
      label: 'Bán nhà',
      objective:
        'Viết bài đăng bán nhà thuyết phục, tập trung giá trị tài sản và tính thanh khoản.',
      requiredSections: 'TỔNG QUAN, GIÁ, TIỆN ÍCH, THÔNG SỐ, VỊ TRÍ, PHÁP LÝ',
      extraRules: ['Nhấn mạnh điểm nổi bật giúp chốt giao dịch nhanh.'],
    },
    SELL_LAND: {
      label: 'Bán đất',
      objective:
        'Viết bài đăng bán đất rõ ràng, nhấn mạnh tiềm năng tăng giá và pháp lý.',
      requiredSections: 'TỔNG QUAN, GIÁ, THÔNG SỐ LÔ ĐẤT, VỊ TRÍ, PHÁP LÝ',
      extraRules: [
        'Ưu tiên nêu mặt tiền, chiều sâu, quy hoạch nếu có dữ liệu.',
      ],
    },
    RENT_HOUSE: {
      label: 'Cho thuê nhà/căn hộ/phòng trọ',
      objective:
        'Viết bài cho thuê rõ điều kiện thuê, ưu tiên tiện ích sống và mức giá.',
      requiredSections:
        'TỔNG QUAN, GIÁ THUÊ, TIỆN ÍCH, THÔNG SỐ, VỊ TRÍ, ĐIỀU KIỆN THUÊ',
      extraRules: [
        'Nêu rõ phù hợp nhóm khách thuê nào (gia đình, sinh viên, nhân viên văn phòng) nếu có dữ liệu.',
      ],
    },
    RENT_LAND: {
      label: 'Cho thuê đất/mặt bằng',
      objective:
        'Viết bài cho thuê đất/mặt bằng phục vụ kinh doanh hoặc lưu trữ.',
      requiredSections:
        'TỔNG QUAN, GIÁ THUÊ, THÔNG SỐ, VỊ TRÍ, MỤC ĐÍCH PHÙ HỢP, ĐIỀU KIỆN THUÊ',
      extraRules: ['Không dùng văn phong bán đứt tài sản.'],
    },
    NEED_BUY: {
      label: 'Cần mua',
      objective:
        'Viết bài đăng nhu cầu tìm mua bất động sản từ góc nhìn người mua.',
      requiredSections:
        'TỔNG QUAN NHU CẦU, NGÂN SÁCH, TIÊU CHÍ BẤT ĐỘNG SẢN, KHU VỰC MONG MUỐN, THÔNG TIN LIÊN HỆ',
      extraRules: [
        'Dùng ngôn ngữ tìm kiếm đối tác bán phù hợp, không viết như đang chào bán tài sản sẵn có.',
        'Nếu có minPrice/maxPrice hoặc minArea/maxArea thì trình bày theo dạng khoảng mong muốn.',
      ],
    },
    NEED_RENT: {
      label: 'Cần thuê',
      objective:
        'Viết bài đăng nhu cầu tìm thuê nhà/căn hộ/phòng trọ/đất từ góc nhìn người thuê.',
      requiredSections:
        'TỔNG QUAN NHU CẦU, NGÂN SÁCH THUÊ, TIÊU CHÍ, KHU VỰC MONG MUỐN, THÔNG TIN LIÊN HỆ',
      extraRules: [
        'Không viết kiểu rao cho thuê tài sản.',
        'Ưu tiên mô tả nhu cầu thực tế và mức ngân sách theo khoảng nếu có dữ liệu.',
      ],
    },
    NEWS: {
      label: 'Tin tức',
      objective:
        'Viết bài tin tức bất động sản trung lập, thông tin rõ ràng, không mang tính chốt sale.',
      requiredSections:
        'TỔNG QUAN, DIỄN BIẾN CHÍNH, TÁC ĐỘNG THỊ TRƯỜNG, GỢI Ý CHO NGƯỜI ĐỌC',
      extraRules: [
        'Giữ giọng văn khách quan, không dùng câu thúc ép mua/thuê ngay.',
      ],
    },
    PROMOTION: {
      label: 'Khuyến mãi',
      objective:
        'Viết bài khuyến mãi rõ điều kiện áp dụng, thời gian và mã ưu đãi.',
      requiredSections:
        'TỔNG QUAN ƯU ĐÃI, NỘI DUNG KHUYẾN MÃI, THỜI GIAN ÁP DỤNG, ĐIỀU KIỆN, CÁCH NHẬN ƯU ĐÃI',
      extraRules: [
        'Nếu có discountCode/startDate/endDate phải hiển thị rõ ràng, dễ nhìn.',
      ],
    },
  };

  async generateDescription(
    dto: GenerateDescriptionDto,
  ): Promise<{ description: string }> {
    const {
      tone,
      postType,
      title,
      price,
      area,
      bedrooms,
      bathrooms,
      direction,
      legalStatus,
      address,
      district,
      ward,
      city,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      startDate,
      endDate,
      discountCode,
      contactPhone,
      contactLink,
      floors,
      frontWidth,
      landLength,
      landType,
    } = dto;

    const normalizedPostType = String(postType || '').toUpperCase();
    const intent = this.postTypeIntentMap[normalizedPostType] || {
      label: normalizedPostType || 'Bài đăng bất động sản',
      objective: 'Viết nội dung phù hợp loại bài đăng được cung cấp.',
      requiredSections: 'TỔNG QUAN, THÔNG TIN CHÍNH, LIÊN HỆ',
      extraRules: [],
    };

    const isNeedPost =
      normalizedPostType === 'NEED_BUY' || normalizedPostType === 'NEED_RENT';
    const isContentPost =
      normalizedPostType === 'NEWS' || normalizedPostType === 'PROMOTION';

    let promptTone =
      tone === 'polite'
        ? 'Lịch sự, chuyên nghiệp, rõ ràng và đáng tin cậy.'
        : 'Thân thiện, gần gũi, dễ đọc, dùng emoji vừa phải và đúng ngữ cảnh.';

    if (isNeedPost) {
      promptTone =
        tone === 'polite'
          ? 'Lịch sự, rõ nhu cầu, văn phong người đang cần tìm mua/thuê, tuyệt đối không mang giọng chào bán/chào thuê.'
          : 'Thân thiện, chân thành, như người đăng đang tìm mua/thuê thật sự; không dùng văn phong quảng cáo tài sản có sẵn.';
    } else if (!isContentPost && tone === 'polite') {
      promptTone =
        'Lịch sự, chuyên nghiệp, nhấn mạnh thông tin quan trọng, trình bày mạch lạc.';
    }

    const details = [
      `Mã loại tin: ${normalizedPostType}`,
      `Tên loại tin: ${intent.label}`,
      `Tiêu đề: ${title}`,
      address ? `Địa chỉ: ${address}` : null,
      ward ? `Phường/Xã: ${ward}` : null,
      district ? `Quận/Huyện: ${district}` : null,
      city ? `Thành phố: ${city}` : null,
      price ? `Giá: ${this.formatVnd(price)}` : null,
      area ? `Diện tích: ${this.formatArea(area)}` : null,
      minPrice ? `Giá tối thiểu mong muốn: ${this.formatVnd(minPrice)}` : null,
      maxPrice ? `Giá tối đa mong muốn: ${this.formatVnd(maxPrice)}` : null,
      minArea
        ? `Diện tích tối thiểu mong muốn: ${this.formatArea(minArea)}`
        : null,
      maxArea
        ? `Diện tích tối đa mong muốn: ${this.formatArea(maxArea)}`
        : null,
      bedrooms ? `Số phòng ngủ: ${bedrooms}` : null,
      bathrooms ? `Số phòng tắm: ${bathrooms}` : null,
      floors ? `Số tầng: ${floors}` : null,
      frontWidth ? `Mặt tiền: ${frontWidth}m` : null,
      landLength ? `Chiều dài đất: ${landLength}m` : null,
      landType ? `Loại đất: ${landType}` : null,
      direction ? `Hướng: ${direction}` : null,
      legalStatus ? `Pháp lý: ${legalStatus}` : null,
      startDate ? `Ngày bắt đầu: ${startDate}` : null,
      endDate ? `Ngày kết thúc: ${endDate}` : null,
      discountCode ? `Mã khuyến mãi: ${discountCode}` : null,
      contactPhone ? `Số điện thoại liên hệ: ${contactPhone}` : null,
      contactLink ? `Link liên hệ: ${contactLink}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const postTypeRules =
      intent.extraRules.length > 0
        ? intent.extraRules.map((rule) => `- ${rule}`).join('\n')
        : '- Không có quy tắc bổ sung.';

    const needPerspectiveRules = isNeedPost
      ? [
          '- BẮT BUỘC viết theo góc nhìn NGƯỜI CẦN TÌM (người mua/người thuê), không phải người đang có tài sản để rao.',
          '- Ưu tiên cấu trúc câu thể hiện nhu cầu: "Tôi đang cần...", "Mình tìm...", "Tiêu chí mong muốn...".',
          '- TUYỆT ĐỐI KHÔNG dùng các cụm mang nghĩa đang rao tài sản: "cho thuê", "bán nhanh", "sở hữu ngay", "chốt sale", "căn này đang", "chính chủ cần cho thuê".',
          '- Không mô tả tài sản như đã sở hữu sẵn (ví dụ: "nhà này", "căn hộ của tôi", "bất động sản này").',
        ].join('\n')
      : '- Không áp dụng.';

    const prompt = `
===SYSTEM===
Bạn là chuyên gia viết nội dung bất động sản Việt Nam.
LUÔN viết bằng TIẾNG VIỆT.
Giọng điệu yêu cầu: ${promptTone}

===NHIỆM VỤ===
Dựa vào thông tin dưới đây, hãy viết phần "Mô tả" rất chi tiết (khoảng 500-800 từ) đúng với loại tin.
Mục tiêu loại tin: ${intent.objective}
TRÌNH BÀY:
- Phải chia thành các đoạn văn ngắn, mỗi đoạn hoặc ý lớn CÁCH NHAU bằng một dòng trống (xuống dòng 1 lần).
- BẮT BUỘC có các tiêu đề phù hợp: ${intent.requiredSections}.
- ĐẶC BIỆT: Gắn các Emoji / Icon trang trí vào đầu và cuối mỗi Tiêu đề (ví dụ: 🌟 TỔNG QUAN 🌟, 💰 GIÁ 💰, 📍 VỊ TRÍ 📍).
- Sử dụng gạch đầu dòng (-) cho các thông số kĩ thuật hoặc cụm tiện ích.
- Dùng dấu **bao quanh văn bản** để in đậm tiêu đề.
- KHÔNG viết đoạn văn cực kỳ dài và dính vào nhau.
- CHỈ sử dụng dữ liệu được cung cấp. Thiếu dữ liệu thì ghi "[Chưa có thông tin]", tuyệt đối không tự bịa.
- Không dùng từ ngữ phân biệt giới tính, vùng miền, nghề nghiệp hoặc nội dung gây phản cảm.

===QUY TẮC THEO LOẠI TIN===
${postTypeRules}

===QUY TẮC GÓC NHÌN NGƯỜI ĐĂNG===
${needPerspectiveRules}

===THÔNG TIN BẤT ĐỘNG SẢN===
${details}
`.trim();

    try {
      const generatedText = await this.generateWithProviders(prompt, {
        temperature: 0.7,
        maxTokens: 800,
      });

      return {
        description:
          generatedText || 'Hiện không thể tạo mô tả. Vui lòng thử lại.',
      };
    } catch (error) {
      this.logger.error(
        `generateDescription error: ${this.stringifyError(error)}`,
      );
      return {
        description:
          'Đã có lỗi xảy ra khi gọi AI để tạo mô tả. Vui lòng thử lại sau.',
      };
    }
  }

  async generatePropertyDescription(
    question: string,
    conversation: ConversationState,
  ): Promise<string> {
    const lastUserTurns = conversation.memory
      .filter((t) => t.role === 'user')
      .slice(-2)
      .map((t) => t.text)
      .join('\n');
    const propertyInfo =
      question.length > 20 ? question : lastUserTurns || question;

    const prompt = [
      'Bạn là chuyên gia viết nội dung bất động sản Việt Nam.',
      'Dựa vào thông tin BĐS bên dưới, hãy viết bài đăng bán/cho thuê ngắn gọn bằng tiếng Việt có dấu.',
      'Định dạng bắt buộc:',
      'TIÊU ĐỀ: [1 dòng, ngắn gọn, có loại BĐS + vị trí + điểm nổi bật]',
      'MÔ TẢ: [80-150 từ: tổng quan, vị trí, đặc điểm chính, pháp lý, lời kêu gọi]',
      'Nếu thiếu thông tin, dùng placeholder [...]. Không bịa dữ liệu.',
      'Kết thúc bằng dòng: --- Bạn có thể copy đoạn mô tả trên để đăng bài! ---',
      '',
      `Thông tin BĐS: ${propertyInfo}`,
    ].join('\n');

    try {
      const raw = await this.generateWithProviders(prompt, {
        temperature: 0.4,
        maxTokens: 400,
      });
      if (raw.length > 50) return raw;
    } catch (error) {
      this.logger.warn(
        `generatePropertyDescription LLM error: ${this.stringifyError(error)}`,
      );
    }

    return this.buildTemplateDescription(propertyInfo);
  }

  private buildTemplateDescription(info: string): string {
    const n = this.normalizeText(info);

    const typeMap: [RegExp, string][] = [
      [/\b(biet thu)\b/, 'Biệt thự'],
      [/\b(can ho|chung cu)\b/, 'Căn hộ chung cư'],
      [/\b(shophouse)\b/, 'Shophouse'],
      [/\b(dat nen|dat)\b/, 'Đất nền'],
      [/\b(nha pho)\b/, 'Nhà phố'],
      [/\b(nha cap 4)\b/, 'Nhà cấp 4'],
      [/\bnha\b/, 'Nhà'],
    ];
    const propType = typeMap.find(([re]) => re.test(n))?.[1] ?? 'Bất động sản';

    const areaMatch = n.match(/(\d+[\d.,]*)\s*m[2²]/);
    const area = areaMatch ? `${areaMatch[1]}m²` : null;

    const priceMatch = n.match(/(\d+[\d.,]*)\s*(ty|trieu|tr)/);
    const price = priceMatch
      ? `${priceMatch[1]} ${priceMatch[2] === 'ty' ? 'tỷ' : 'triệu'} đồng`
      : null;

    const bedroomMatch = n.match(/(\d+)\s*(pn|phong ngu|phong)/);
    const bedrooms = bedroomMatch ? `${bedroomMatch[1]} phòng ngủ` : null;

    const floorMatch = n.match(/(\d+)\s*tang/);
    const floors = floorMatch ? `${floorMatch[1]} tầng` : null;

    const locationMatch = info.match(
      /(quận|huyện|phường|xã|đường|thành phố|TP\.?\s*\w+|Hà Nội|HCM|Đà Nẵng)[^,.\n]*/i,
    );
    const location = locationMatch ? locationMatch[0].trim() : null;

    const legalMatch = n.match(/(so hong|so do|so rieng|chu quyen)/);
    const legal = legalMatch
      ? legalMatch[1] === 'so hong'
        ? 'Sổ hồng'
        : legalMatch[1] === 'so do'
          ? 'Sổ đỏ'
          : 'Pháp lý đầy đủ'
      : null;

    const action = /cho thue/.test(n) ? 'Cho thuê' : 'Bán';

    const titleParts = [action, propType, area, location, price].filter(
      Boolean,
    );
    const title = titleParts.join(' – ');

    const details = [
      `- Loại BĐS: ${propType}`,
      area ? `- Diện tích: ${area}` : null,
      bedrooms ? `- Số phòng ngủ: ${bedrooms}` : null,
      floors ? `- Số tầng: ${floors}` : null,
      location ? `- Vị trí: ${location}` : null,
      legal ? `- Pháp lý: ${legal}` : null,
      price ? `- Giá ${action === 'Bán' ? 'bán' : 'thuê'}: ${price}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      `TIÊU ĐỀ: ${title}`,
      '',
      'MÔ TẢ:',
      `${action} ${propType.toLowerCase()}${location ? ` tọa lạc tại ${location}` : ''}${area ? `, diện tích ${area}` : ''}.`,
      bedrooms || floors
        ? `Căn nhà ${[bedrooms, floors].filter(Boolean).join(', ')}, thiết kế hợp lý, không gian thoáng mát.`
        : '',
      legal ? `Pháp lý minh bạch, ${legal} chính chủ, giao dịch an toàn.` : '',
      price
        ? `Giá ${action === 'Bán' ? 'bán' : 'thuê'}: **${price}** – thương lượng cho khách thiện chí.`
        : '',
      '',
      'Chi tiết:',
      details,
      '',
      'Liên hệ ngay để được tư vấn và xem nhà thực tế!',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const num = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
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

  private async generateWithProviders(
    prompt: string,
    options: { temperature: number; maxTokens: number },
  ): Promise<string> {
    if (this.llmProvider && this.llmProvider !== 'gemini') {
      this.logger.warn(
        `LLM_PROVIDER=${this.llmProvider} is set. API-only mode expects gemini.`,
      );
      return '';
    }

    return this.generateWithGemini(prompt, options);
  }

  private async generateWithGemini(
    prompt: string,
    options: { temperature: number; maxTokens: number },
  ): Promise<string> {
    if (!this.geminiApiKey) {
      this.logger.warn('GEMINI_API_KEY is missing.');
      return '';
    }

    const modelCandidates = Array.from(
      new Set(
        [
          this.geminiModelPrimary,
          this.geminiModelFallback1,
          this.geminiModelFallback2,
        ]
          .map((m) => String(m || '').trim())
          .filter(Boolean),
      ),
    );

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt <= this.geminiMaxRetries; attempt++) {
        try {
          const response = await axios.post(
            `${this.geminiApiUrl}/models/${model}:generateContent?key=${encodeURIComponent(this.geminiApiKey)}`,
            {
              contents: [
                {
                  role: 'user',
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens,
                thinkingConfig: {
                  thinkingBudget: this.geminiThinkingBudget,
                },
              },
            },
            {
              timeout: this.geminiTimeoutMs,
              headers: { 'Content-Type': 'application/json' },
            },
          );

          const text = response.data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p?.text || '')
            .join('')
            .trim();

          if (text) return text;

          if (attempt < this.geminiMaxRetries) {
            await this.sleep(this.geminiRetryBaseMs * (attempt + 1));
          }
        } catch (error) {
          const retryable = this.isRetryableGeminiError(error);
          const waitMs =
            this.extractRetryDelayMs(error) ??
            this.geminiRetryBaseMs * (attempt + 1);

          this.logger.warn(
            `Gemini model ${model} error (attempt ${attempt + 1}/${this.geminiMaxRetries + 1}): ${this.stringifyError(error)}`,
          );

          if (!retryable || attempt >= this.geminiMaxRetries) {
            break;
          }

          await this.sleep(waitMs);
        }
      }
    }

    return '';
  }

  private isRetryableGeminiError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    const status = error.response?.status;
    if (
      status === 429 ||
      status === 408 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      return true;
    }

    const code = (error.code || '').toUpperCase();
    return code === 'ECONNABORTED' || code === 'ETIMEDOUT';
  }

  private extractRetryDelayMs(error: unknown): number | null {
    if (!axios.isAxiosError(error)) return null;

    const retryAfterHeader = error.response?.headers?.['retry-after'];
    if (retryAfterHeader) {
      const seconds = Number(retryAfterHeader);
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
      }
    }

    const retryDelayRaw = error.response?.data?.error?.details?.find(
      (d: { '@type'?: string }) =>
        d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
    )?.retryDelay;

    if (typeof retryDelayRaw === 'string') {
      const match = retryDelayRaw.match(/(\d+)/);
      if (match) return Number(match[1]) * 1000;
    }

    return null;
  }

  private async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
