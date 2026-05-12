import { Injectable, Logger } from '@nestjs/common';
import { FinancingResult } from '../types/ai.types';
import { AiUtils } from '../utils/ai.utils';

/**
 * @file financing-advisor.service.ts
 * @description Tư vấn tài chính và tính toán khả năng vay mua BĐS.
 *
 * CHỨC NĂNG:
 *   1. calculateFinancing()      — Tính toán với công thức PMT (chính xác toán học)
 *   2. buildFinancingAnswer()    — Xây dựng câu trả lời tư vấn toàn diện
 *   3. getGeminiFinancingAdvice()— Gọi Gemini khi câu hỏi tài chính chung chung
 *   4. getDefaultFinancingAdvice()—Fallback hướng dẫn chuẩn (không cần API)
 *
 * THÔNG SỐ MẶC ĐỊNH (thực tế Việt Nam):
 *   - Lãi suất: 8%/năm (ưu đãi năm đầu)
 *   - Tỷ lệ vay/giá trị (LTV): 70%
 *   - Kỳ hạn vay: 20 năm
 *   - Tỉ lệ trả góp tối đa: 40% thu nhập
 *
 * CÔNG THỨC PMT (Payment per period):
 *   Chế độ thu nhập → tính ngược PMT: PV = PMT × [(1 - (1+r)^-n) / r]
 *   Chế độ giá BDS → tính PMT: PMT = PV × [r(1+r)^n / ((1+r)^n - 1)]
 */
/**
 * Provides mortgage/financing calculations and advice.
 * Helps users understand how much they can afford and what their monthly payments would be.
 */
@Injectable()
export class FinancingAdvisorService {
  private readonly logger = new Logger(FinancingAdvisorService.name);
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly geminiChatModel =
    process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
  private readonly geminiApiBase =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta';
  private readonly geminiTimeoutMs = Number(
    process.env.GEMINI_TIMEOUT_MS || 15000,
  );

  // Default Vietnamese mortgage parameters
  private readonly defaultInterestRate = 0.08; // 8% annual (year 1 preferential)
  private readonly defaultLoanToValue = 0.7; // 70% max LTV
  private readonly defaultLoanTermYears = 20;
  private readonly maxDebtToIncome = 0.4; // 40% of income

  /**
   * Calculate mortgage details based on income and property price.
   */
  calculateFinancing(
    monthlyIncome?: number,
    propertyPrice?: number,
    downPayment?: number,
    interestRate?: number,
    loanTermYears?: number,
  ): FinancingResult | null {
    const rate = interestRate ?? this.defaultInterestRate;
    const termYears = loanTermYears ?? this.defaultLoanTermYears;
    const monthlyRate = rate / 12;
    const totalMonths = termYears * 12;

    if (monthlyIncome && monthlyIncome > 0) {
      // Calculate from income
      const maxMonthlyPayment = monthlyIncome * this.maxDebtToIncome;

      // PMT formula inverse: PV = PMT × [(1 - (1+r)^-n) / r]
      const pvFactor =
        (1 - Math.pow(1 + monthlyRate, -totalMonths)) / monthlyRate;
      const maxLoanAmount = Math.round(maxMonthlyPayment * pvFactor);
      const affordablePrice = Math.round(
        maxLoanAmount / this.defaultLoanToValue,
      );
      const downPaymentRequired = affordablePrice - maxLoanAmount;
      const totalPayment = maxMonthlyPayment * totalMonths;
      const totalInterest = totalPayment - maxLoanAmount;

      return {
        maxLoanAmount,
        monthlyPayment: Math.round(maxMonthlyPayment),
        totalInterest: Math.round(totalInterest),
        totalPayment: Math.round(totalPayment),
        affordablePrice,
        loanToValue: this.defaultLoanToValue,
        interestRate: rate,
        loanTermYears: termYears,
        downPaymentRequired,
      };
    }

    if (propertyPrice && propertyPrice > 0) {
      // Calculate from property price
      const actualDownPayment =
        downPayment ??
        Math.round(propertyPrice * (1 - this.defaultLoanToValue));
      const loanAmount = propertyPrice - actualDownPayment;
      const ltv = loanAmount / propertyPrice;

      // PMT formula: PMT = PV × [r(1+r)^n / ((1+r)^n - 1)]
      const pmtFactor =
        (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1);
      const monthlyPayment = Math.round(loanAmount * pmtFactor);
      const totalPayment = monthlyPayment * totalMonths;
      const totalInterest = totalPayment - loanAmount;

      return {
        maxLoanAmount: loanAmount,
        monthlyPayment,
        totalInterest: Math.round(totalInterest),
        totalPayment: Math.round(totalPayment),
        affordablePrice: propertyPrice,
        loanToValue: ltv,
        interestRate: rate,
        loanTermYears: termYears,
        downPaymentRequired: actualDownPayment,
      };
    }

    return null;
  }

  /**
   * Build a comprehensive financing advice answer.
   */
  async buildFinancingAnswer(question: string): Promise<string> {
    const normalized = AiUtils.normalizeText(question);

    // Try to extract financial parameters from question
    const monthlyIncome = this.extractMonthlyIncome(normalized);
    const propertyPrice = this.extractPropertyPrice(normalized);
    const downPayment = this.extractDownPayment(normalized);

    const result = this.calculateFinancing(
      monthlyIncome,
      propertyPrice,
      downPayment,
    );

    if (result) {
      return this.formatFinancingResult(result, monthlyIncome, propertyPrice);
    }

    // Fallback: use Gemini for general financing advice
    return this.getGeminiFinancingAdvice(question);
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private formatFinancingResult(
    result: FinancingResult,
    monthlyIncome?: number,
    propertyPrice?: number,
  ): string {
    const lines: string[] = [];
    lines.push('💰 **Tư vấn tài chính mua BĐS:**');
    lines.push('');

    if (monthlyIncome) {
      lines.push(
        `📊 **Thu nhập hàng tháng:** ${AiUtils.formatVnd(monthlyIncome)}`,
      );
      lines.push('');
    }

    lines.push('🏦 **Kết quả tính toán:**');
    lines.push(
      `- Giá BĐS có thể mua: **${AiUtils.formatVnd(result.affordablePrice)}**`,
    );
    lines.push(
      `- Số tiền cần trả trước (${((1 - result.loanToValue) * 100).toFixed(0)}%): **${AiUtils.formatVnd(result.downPaymentRequired)}**`,
    );
    lines.push(
      `- Số tiền vay tối đa: **${AiUtils.formatVnd(result.maxLoanAmount)}**`,
    );
    lines.push(
      `- Trả góp hàng tháng: **${AiUtils.formatVnd(result.monthlyPayment)}**`,
    );
    lines.push(
      `- Lãi suất: **${(result.interestRate * 100).toFixed(1)}%/năm**`,
    );
    lines.push(`- Thời hạn vay: **${result.loanTermYears} năm**`);
    lines.push('');
    lines.push('📋 **Chi tiết khoản vay:**');
    lines.push(
      `- Tổng tiền phải trả: ${AiUtils.formatVnd(result.totalPayment)}`,
    );
    lines.push(
      `- Tổng lãi phải trả: ${AiUtils.formatVnd(result.totalInterest)}`,
    );
    lines.push('');

    if (monthlyIncome) {
      const ratio = result.monthlyPayment / monthlyIncome;
      if (ratio > 0.35) {
        lines.push('⚠️ **Lưu ý:** Tỷ lệ trả góp/thu nhập khá cao. Nên:');
        lines.push('- Tăng số tiền trả trước');
        lines.push('- Xem xét BĐS giá thấp hơn');
        lines.push('- Kéo dài thời hạn vay');
      } else {
        lines.push(
          '✅ **Tỷ lệ trả góp hợp lý**, phù hợp với thu nhập hiện tại.',
        );
      }
    }

    lines.push('');
    lines.push(
      '_⚠️ Lãi suất tham khảo. Lãi suất thực tế phụ thuộc ngân hàng và thời điểm vay. Năm đầu thường có ưu đãi 6-8%, sau đó tăng lên 10-12%/năm._',
    );

    return lines.join('\n');
  }

  private extractMonthlyIncome(normalized: string): number | undefined {
    const incomeMatch = normalized.match(
      /(?:thu nhap|luong|salary|income)\s*(?:la|khoang|hang thang)?\s*([0-9.,]+)\s*(ty|trieu|tr)/,
    );
    if (incomeMatch) {
      return AiUtils.toVnd(incomeMatch[1], incomeMatch[2]);
    }
    return undefined;
  }

  private extractPropertyPrice(normalized: string): number | undefined {
    const priceMatch = normalized.match(
      /(?:gia|nha|can ho|bds|bat dong san)\s*(?:la|khoang)?\s*([0-9.,]+)\s*(ty|trieu|tr)/,
    );
    if (priceMatch) {
      return AiUtils.toVnd(priceMatch[1], priceMatch[2]);
    }

    // Generic price extraction
    const genericMatch = normalized.match(
      /(?:mua|vay)\s*(?:nha|dat|can ho)?\s*([0-9.,]+)\s*(ty|trieu|tr)/,
    );
    if (genericMatch) {
      return AiUtils.toVnd(genericMatch[1], genericMatch[2]);
    }

    return undefined;
  }

  private extractDownPayment(normalized: string): number | undefined {
    const dpMatch = normalized.match(
      /(?:tra truoc|dat coc|down payment|co)\s*([0-9.,]+)\s*(ty|trieu|tr)/,
    );
    if (dpMatch) {
      return AiUtils.toVnd(dpMatch[1], dpMatch[2]);
    }
    return undefined;
  }

  private async getGeminiFinancingAdvice(question: string): Promise<string> {
    if (!this.geminiApiKey) {
      return this.getDefaultFinancingAdvice();
    }

    try {
      const prompt = [
        'Bạn là chuyên gia tài chính bất động sản Việt Nam.',
        '',
        `Câu hỏi: ${question}`,
        '',
        'Yêu cầu trả lời:',
        '1. Phân tích khả năng tài chính dựa trên thông tin',
        '2. Tư vấn phương án vay vốn hợp lý',
        '3. Nêu lãi suất tham khảo (ưu đãi 6-8%, sau 10-12%/năm)',
        '4. Lưu ý về chi phí phát sinh (thuế, công chứng ~5-7% giá)',
        '5. Trả lời bằng tiếng Việt có dấu, dưới 250 từ',
        '6. Dùng gạch đầu dòng và in đậm',
      ].join('\n');

      const text = await AiUtils.generateLlmResponse(
        prompt,
        'Bạn là chuyên gia tài chính BĐS Việt Nam. Trả lời chính xác, chuyên nghiệp.',
        { temperature: 0.3, maxTokens: 1200, timeout: Math.max(this.geminiTimeoutMs, 25000) },
      );

      if (text && text.length > 50) {
        return `💰 **Tư vấn tài chính BĐS:**\n\n${text}`;
      }
    } catch (error) {
      this.logger.warn(
        `Gemini financing advice failed: ${AiUtils.stringifyError(error)}`,
      );
    }

    return this.getDefaultFinancingAdvice();
  }

  private getDefaultFinancingAdvice(): string {
    return [
      '💰 **Tư vấn tài chính mua BĐS:**',
      '',
      '🏦 **Quy trình vay mua nhà tại ngân hàng:**',
      '1. **Điều kiện:** Thu nhập ổn định, CCCD, hộ khẩu',
      '2. **Tỷ lệ cho vay:** 60-70% giá trị BĐS',
      '3. **Lãi suất:** Ưu đãi năm đầu 6-8%/năm, sau đó 10-12%/năm',
      '4. **Thời hạn:** 10-25 năm, trả góp hàng tháng',
      '',
      '📋 **Công thức tính nhanh:**',
      '- Thu nhập 30 triệu/tháng → vay tối đa ~1.8 tỷ',
      '- Thu nhập 50 triệu/tháng → vay tối đa ~3 tỷ',
      '- Trả góp không nên vượt 40% thu nhập',
      '',
      '⚡ **Tip:** Bạn có thể cho mình biết thu nhập hoặc giá BĐS để mình tính chính xác hơn!',
      '',
      'Ví dụ: "Thu nhập 30 triệu, muốn mua nhà 3 tỷ"',
    ].join('\n');
  }
}
