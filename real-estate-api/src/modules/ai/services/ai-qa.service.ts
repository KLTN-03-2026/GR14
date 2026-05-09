import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AiUtils } from '../utils/ai.utils';

@Injectable()
export class AiQAService {
  private readonly logger = new Logger(AiQAService.name);
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly geminiChatModel = process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
  private readonly geminiApiBase = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
  private readonly geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 15000);

  public answerQA(
    question: string,
  ): { answer: string; suggestedQuestions: string[] } | null {
    const normalized = AiUtils.normalizeText(question);
    const qaBank: {
      pattern: RegExp;
      answer: string;
      suggestedQuestions: string[];
    }[] = [
        {
          pattern: /\bso hong\b/,
          answer:
            'Sổ hồng (Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất) là văn bản pháp lý do Nhà nước cấp cho chủ sở hữu bất động sản. Đây là giấy tờ quan trọng nhất khi mua bán nhà đất, giúp đảm bảo quyền lợi hợp pháp của người sở hữu.\n\nLưu ý khi mua nhà:\n- Kiểm tra sổ hồng chính chủ\n- Xác minh thông tin trên sổ với thực tế\n- Kiểm tra có bị thế chấp hay tranh chấp không',
          suggestedQuestions: [
            'Sổ đỏ khác sổ hồng thế nào?',
            'Thủ tục mua bán nhà đất',
            'Tìm nhà có sổ hồng',
          ],
        },
        {
          pattern: /\bso do\b/,
          answer:
            'Sổ đỏ là tên gọi dân gian của Giấy chứng nhận quyền sử dụng đất (bìa đỏ). Hiện nay, sổ đỏ và sổ hồng đã được hợp nhất thành một loại giấy chứng nhận duy nhất, thường gọi chung là "sổ hồng".\n\nSự khác biệt trước đây:\n- Sổ đỏ: cấp cho đất không có nhà\n- Sổ hồng: cấp cho nhà ở và đất ở đô thị',
          suggestedQuestions: [
            'Sổ hồng là gì?',
            'Thủ tục sang tên sổ đỏ',
            'Tìm đất nền có sổ',
          ],
        },
        {
          pattern: /\b(cong chung|thu tuc|sang ten)\b/,
          answer:
            'Thủ tục công chứng mua bán nhà đất gồm các bước chính:\n1. Hai bên thỏa thuận giá và điều khoản\n2. Chuẩn bị hồ sơ: CMND/CCCD, sổ hồng, hợp đồng mua bán\n3. Công chứng hợp đồng tại văn phòng công chứng\n4. Nộp thuế (thuế thu nhập cá nhân 2%, lệ phí trước bạ 0.5%)\n5. Đăng ký sang tên tại Văn phòng đăng ký đất đai\n\nThời gian: khoảng 15-30 ngày làm việc.',
          suggestedQuestions: [
            'Phí công chứng bao nhiêu?',
            'Tìm nhà ở Đà Nẵng',
            'Kinh nghiệm mua nhà lần đầu',
          ],
        },
        {
          pattern: /(?=.*\b(thue|phi|le phi|truoc ba)\b)(?=.*\b(mua|ban|nha|dat)\b)/,
          answer:
            'Các loại thuế/phí khi mua bán bất động sản:\n- Thuế thu nhập cá nhân (TNCN): 2% giá bán (người bán chịu)\n- Lệ phí trước bạ: 0.5% giá trị BĐS (người mua chịu)\n- Phí công chứng: theo biểu phí quy định\n- Phí thẩm định hồ sơ: khoảng 0.15% giá trị BĐS\n\nLưu ý: Một số trường hợp được miễn thuế TNCN (nhà duy nhất, sở hữu trên 5 năm...).',
          suggestedQuestions: [
            'Thủ tục mua bán nhà đất',
            'Sổ hồng là gì?',
            'Tìm nhà dưới 3 tỷ',
          ],
        },
        {
          pattern: /(?=.*\b(kinh nghiem|luu y|loi khuyen)\b)(?=.*\b(mua|lan dau)\b)/,
          answer:
            'Kinh nghiệm mua nhà lần đầu:\n1. Xác định ngân sách rõ ràng (bao gồm phí phát sinh)\n2. Ưu tiên vị trí: gần trường học, bệnh viện, chợ\n3. Kiểm tra pháp lý: sổ hồng, quy hoạch, tranh chấp\n4. Xem nhà thực tế nhiều lần, nhiều thời điểm\n5. Kiểm tra kết cấu, hệ thống điện nước\n6. So sánh giá với khu vực lân cận\n7. Thương lượng giá hợp lý\n8. Sử dụng dịch vụ công chứng uy tín\n\nĐừng vội vàng, hãy tìm hiểu kỹ trước khi quyết định!',
          suggestedQuestions: [
            'Tìm nhà dưới 3 tỷ',
            'Sổ hồng là gì?',
            'Thủ tục mua bán nhà đất',
          ],
        },
        {
          pattern: /\b(phong thuy|feng\s*shui|huong nha|tuoi)\b/,
          answer:
            'Phong thủy khi mua nhà là yếu tố nhiều người Việt quan tâm:\n- Hướng nhà: nên chọn hướng hợp tuổi gia chủ\n- Hình dáng đất: vuông vức là tốt nhất\n- Đường vào nhà: tránh ngõ cụt, đường đâm thẳng vào nhà\n- Xung quanh: tránh gần nghĩa trang, bệnh viện, đường cao tốc\n\nTuy nhiên, vị trí, giá cả và pháp lý vẫn là yếu tố quan trọng nhất khi quyết định mua.',
          suggestedQuestions: [
            'Tìm nhà hướng Đông',
            'Kinh nghiệm mua nhà lần đầu',
            'Tìm đất nền giá rẻ',
          ],
        },
        {
          pattern: /(?=.*\b(vay|ngan hang|lai suat|tra gop)\b)(?=.*\b(nha|dat|bds)\b)/,
          answer:
            'Quy trình vay mua nhà tại ngân hàng:\n1. Điều kiện: Thu nhập ổn định, CCCD, hộ khẩu\n2. Tỷ lệ cho vay: 60-70% giá trị BĐS\n3. Lãi suất: Ưu đãi năm đầu 6-8%/năm, sau đó 10-12%/năm\n4. Thời hạn: 10-25 năm, trả góp hàng tháng\n5. Hồ sơ: CCCD, xác nhận thu nhập, hợp đồng mua bán, sổ hồng\n\nLưu ý: Tổng trả góp không nên vượt 40% thu nhập.',
          suggestedQuestions: [
            'Kinh nghiệm mua nhà lần đầu',
            'Thuế phí mua nhà bao nhiêu?',
            'Tìm nhà dưới 3 tỷ',
          ],
        },
        {
          pattern: /\b(quy hoach|trong quy hoach|kiem tra quy hoach)\b/,
          answer:
            'Kiểm tra quy hoạch trước khi mua BĐS:\n\nCách kiểm tra:\n1. Tra cứu trực tuyến trên website Sở TN&MT\n2. Đến UBND phường/xã xin trích lục bản đồ\n3. Kiểm tra tại Văn phòng đăng ký đất đai\n\nCác loại cần kiểm tra:\n- Quy hoạch sử dụng đất (ở/nông nghiệp/công)\n- Quy hoạch giao thông (lộ giới)\n- Quy hoạch xây dựng (mật độ, tầng cao)\n\n⚠️ BĐS nằm trong vùng quy hoạch có thể bị thu hồi hoặc không được cấp phép xây dựng.',
          suggestedQuestions: [
            'Sổ hồng là gì?',
            'Kinh nghiệm mua nhà lần đầu',
            'Tìm đất nền có sổ',
          ],
        },
        {
          pattern: /\b(dat coc|hop dong dat coc|tien coc)\b/,
          answer:
            'Hợp đồng đặt cọc mua BĐS:\n\nNội dung bắt buộc:\n- Thông tin hai bên, mô tả BĐS\n- Số tiền cọc (thường 5-10% giá trị)\n- Thời hạn giao dịch, điều khoản phạt\n\nQuy định pháp luật:\n- Bên mua bỏ cọc → mất tiền cọc\n- Bên bán bỏ cọc → trả gấp đôi\n\nLời khuyên:\n- Nên công chứng hợp đồng\n- Kiểm tra kỹ pháp lý trước khi cọc\n- Không cọc quá 10% giá trị',
          suggestedQuestions: [
            'Thủ tục mua bán nhà đất',
            'Kinh nghiệm mua nhà lần đầu',
            'Tìm nhà dưới 5 tỷ',
          ],
        },
        {
          pattern: /(?=.*\b(dat nen|dat tho cu|dat nong nghiep|loai dat|dat)\b)(?=.*\b(khac|la gi|nghia|phan biet)\b)/,
          answer:
            'Phân biệt các loại đất:\n\nĐất thổ cư (đất ở): Được xây nhà, cấp sổ hồng, giá cao nhất.\nĐất nền: Đã quy hoạch phân lô, cần kiểm tra pháp lý dự án.\nĐất nông nghiệp: CHỈ dùng sản xuất, KHÔNG được xây nhà. Muốn xây phải chuyển đổi mục đích (mất phí).\nĐất công: Thuộc sở hữu Nhà nước, không được mua bán.',
          suggestedQuestions: [
            'Quy hoạch đất là gì?',
            'Tìm đất nền có sổ',
            'Sổ hồng là gì?',
          ],
        },
        {
          pattern: /\b(giay phep xay|xin phep xay|phep xay)\b/,
          answer:
            'Giấy phép xây dựng (GPXD):\n\nHồ sơ: Đơn xin, sổ hồng, bản vẽ thiết kế, CCCD.\nThời gian: 15-20 ngày làm việc.\nChi phí: 75.000 - 150.000 VNĐ.\n\nMiễn phép: Nhà ở riêng lẻ tại nông thôn (một số vùng), sửa chữa nhỏ.\n⚠️ Xây không phép phạt 40-80 triệu và buộc tháo dỡ.',
          suggestedQuestions: [
            'Quy hoạch đất là gì?',
            'Sổ hồng là gì?',
            'Tìm nhà dưới 3 tỷ',
          ],
        },
        {
          pattern: /\b(tim tuong|thong thuy|dien tich su dung|dien tich san)\b/,
          answer:
            'Phân biệt diện tích BĐS:\n\nDiện tích tim tường: Đo từ tâm tường bao, bao gồm tường. Thường ghi trên sổ hồng.\nDiện tích thông thủy: Đo từ mặt trong tường, diện tích sử dụng thực tế.\n\nVí dụ: Sổ hồng ghi 80m² (tim tường) → thực tế sử dụng khoảng 72-75m² (thông thủy).\n\n💡 Luôn hỏi rõ loại diện tích khi mua nhà!',
          suggestedQuestions: [
            'Kinh nghiệm mua nhà lần đầu',
            'Sổ hồng là gì?',
            'Tìm căn hộ dưới 3 tỷ',
          ],
        },
        {
          pattern: /(?=.*\b(dau tu|sinh loi|loi nhuan)\b)(?=.*\b(bds|bat dong san|nha|dat)\b)/,
          answer:
            'Kinh nghiệm đầu tư BĐS:\n\n1. Mua đất nền chờ tăng giá (lãi 15-30%/năm, rủi ro pháp lý)\n2. Mua căn hộ cho thuê (lãi 4-7%/năm, ổn định)\n3. Mua nhà phố cho thuê mặt bằng (lãi 3-5%/năm)\n\nNguyên tắc vàng:\n- Vị trí, vị trí, vị trí\n- Pháp lý rõ ràng, sổ hồng\n- Không dùng quá 50% vốn vay\n\n⚠️ Tránh dự án ma, đất nông nghiệp rao bán như đất ở.',
          suggestedQuestions: [
            'Tìm đất nền giá rẻ',
            'Quy hoạch đất là gì?',
            'Tìm nhà cho thuê',
          ],
        },
      ];

    for (const qa of qaBank) {
      if (qa.pattern.test(normalized)) {
        return { answer: qa.answer, suggestedQuestions: qa.suggestedQuestions };
      }
    }

    this.logger.debug(`QA bank miss: "${normalized.slice(0, 80)}"`);
    return null;
  }

  public async answerQAWithGemini(question: string): Promise<string | null> {
    if (!this.geminiApiKey) return null;
    try {
      const systemPrompt = [
        'Bạn là chuyên gia tư vấn bất động sản Việt Nam.',
        'Trả lời câu hỏi kiến thức BĐS bằng tiếng Việt có dấu, rõ ràng, chính xác.',
        'Nếu câu hỏi không liên quan đến BĐS, trả lời "Mình chỉ hỗ trợ về bất động sản thôi nhé!"',
        'Giới hạn trả lời trong 200 từ. Dùng gạch đầu dòng nếu cần.',
      ].join('\n');

      const text = await AiUtils.generateLlmResponse(question, systemPrompt, {
        temperature: 0.3,
        maxTokens: 1000,
        timeout: this.geminiTimeoutMs,
      });

      return (text && text.length > 20) ? text : null;
    } catch (error) {
      this.logger.warn(`Gemini QA fallback failed: ${AiUtils.stringifyError(error)}`);
      return null;
    }
  }
}

