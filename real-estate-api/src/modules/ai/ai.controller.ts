/**
 * @file ai.controller.ts
 * @description Controller của AI Module — định nghĩa 3 REST endpoint công khai cho chatbot BĐS.
 *
 * ENDPOINTS:
 *   POST /ai/chat              — Gửi câu hỏi đến chatbot (không cần đăng nhập)
 *   POST /ai/index             — Trigger re-indexing dữ liệu BĐS vào Qdrant Vector DB
 *   POST /ai/generate-description — Tạo mô tả tin đăng bằng AI (chỉ dành cho tài khoản VIP)
 *
 * LUỒNG XỬ LÝ:
 *   Request → AiController → AiService (Orchestrator chính) → Response
 *
 * AUTH:
 *   - /chat và /index: public, không cần xác thực
 *   - /generate-description: yêu cầu JWT token hợp lệ (JwtAuthGuard)
 *     AiService sẽ kiểm tra thêm role VIP trước khi cho phép generate
 */
import { Body, Controller, Post, Query, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { IndexDto } from './dto/index.dto';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * AiController
 *
 * Lớp controller mỏng (thin controller) — chỉ nhận request, validate DTO (qua class-validator),
 * rồi chuyển toàn bộ logic xử lý sang AiService. Không chứa business logic.
 */
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /ai/chat
   * Endpoint chính của chatbot — xử lý câu hỏi từ người dùng.
   *
   * Luồng xử lý trong AiService:
   *   1. parseIntent()       → Phân tích ý định bằng Gemini LLM (fallback: regex)
   *   2. getConversationState() → Lấy lịch sử hội thoại từ Redis
   *   3. handleSpecialFlow() → Kiểm tra xem có phải Compare/Direct intent không
   *   4. hybridSearch()      → Tìm BĐS qua Qdrant (Dense + Sparse + RRF)
   *   5. generateContent()   → Sinh câu trả lời JSON bằng Gemini
   *   6. updateMemory()      → Lưu lượt hội thoại mới vào Redis
   *
   * @param dto { sessionId: string, question: string }
   * @returns ChatResult { ok, sessionId, answer, sources, suggestedQuestions, ... }
   */
  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  /**
   * POST /ai/index
   * Trigger re-indexing toàn bộ dữ liệu BĐS (house, land, post) vào Qdrant Vector DB.
   *
   * Quy trình:
   *   1. Lấy dữ liệu từ MySQL (tối đa `limit` bản ghi mỗi loại)
   *   2. Chuyển mỗi record thành IndexedDoc (text + payload metadata)
   *   3. Gọi Ollama để embed text → Dense Vector 768D
   *   4. Tính BM25 Sparse Vector cho Hybrid Search
   *   5. Upsert tất cả vectors vào Qdrant collection
   *
   * ID Schema trong Qdrant:
   *   - House: 1_000_000 + house.id
   *   - Land:  2_000_000 + land.id
   *   - Post:  3_000_000 + post.id
   *
   * @param dto { limit?: number } — Số bản ghi tối đa mỗi loại (mặc định 200)
   */
  @Post('index')
  index(@Query() dto: IndexDto) {
    return this.aiService.indexData(dto.limit ?? 200);
  }

  /**
   * POST /ai/generate-description
   * Tạo nội dung mô tả tin đăng BĐS bằng AI — tính năng dành riêng cho tài khoản VIP.
   *
   * Yêu cầu:
   *   - Đã đăng nhập (JWT hợp lệ — bắt buộc bởi JwtAuthGuard)
   *   - Tài khoản VIP còn hạn (isVip = true & vipExpiry > now — kiểm tra trong AiService)
   *
   * Hỗ trợ 8 loại tin:
   *   SELL_HOUSE, SELL_LAND, RENT_HOUSE, RENT_LAND,
   *   NEED_BUY, NEED_RENT, NEWS, PROMOTION
   *
   * Tone văn phong: 'polite' (chuyên nghiệp) | 'friendly' (thân thiện)
   *
   * @param req  Request object — lấy userId và roles từ JWT payload
   * @param dto  GenerateDescriptionDto — thông tin BĐS và các tham số bổ sung
   * @returns { description: string } — Nội dung mô tả được tạo bởi Gemini
   */
  @Post('generate-description')
  @UseGuards(JwtAuthGuard)
  generateDescription(@Req() req: any, @Body() dto: GenerateDescriptionDto) {
    const userId: number = req.user?.id;
    const roles: string[] = req.user?.roles ?? [];
    return this.aiService.generateDescription(dto, userId, roles);
  }
}
