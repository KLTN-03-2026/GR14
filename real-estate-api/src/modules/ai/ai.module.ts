/**
 * @file ai.module.ts
 * @description NestJS Module Registration cho toàn bộ AI Chatbot system.
 *
 * Module này tập hợp và đăng ký tất cả services của AI module vào Dependency Injection
 * container của NestJS. Các service được inject vào nhau thông qua constructor,
 * không cần khởi tạo thủ công.
 *
 * CẤU TRÚC MODULE:
 *   controllers: [AiController]          — Xử lý HTTP request đến /ai/*
 *   providers:   7 services (xem bên dưới) — Chứa toàn bộ business logic
 *   exports:     [AiService]             — Cho phép module khác inject AiService
 *                                           (ví dụ: RecommendationModule dùng embedding)
 *
 * DEPENDENCY GRAPH (đơn giản hoá):
 *   AiController
 *     └── AiService (Orchestrator)
 *           ├── AiQAService              ← Hỏi đáp kiến thức BĐS
 *           ├── AiChatCompareService     ← So sánh BĐS (5 strategies)
 *           ├── MarketInsightService     ← Phân tích thị trường
 *           ├── FinancingAdvisorService  ← Tư vấn tài chính/vay vốn
 *           ├── UserProfileService       ← Cá nhân hóa theo sessionId
 *           └── DescriptionGeneratorService ← Tạo mô tả tin đăng AI
 */
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiChatCompareService } from './ai-chat-compare.service';
import {
  DescriptionGeneratorService,
  AiQAService,
  UserProfileService,
  MarketInsightService,
  FinancingAdvisorService,
} from './services';

@Module({
  controllers: [AiController],
  providers: [
    // ─── Orchestrator chính ───────────────────────────────────────────────────
    // Điều phối toàn bộ pipeline: intent → search → generate → memory update
    AiService,

    // ─── Sub-Services chức năng ───────────────────────────────────────────────
    // Xử lý luồng so sánh BĐS với 5 chiến lược tìm kiếm linh hoạt
    AiChatCompareService,

    // Tạo nội dung mô tả tin đăng BĐS bằng AI (tính năng VIP)
    DescriptionGeneratorService,

    // Hỏi đáp kiến thức BĐS: Static QA Bank (regex) + Gemini fallback
    AiQAService,

    // Quản lý và học hỏi hồ sơ người dùng theo sessionId (lưu Redis 7 ngày)
    UserProfileService,

    // Phân tích thị trường BĐS theo khu vực và đưa ra nhận định đầu tư
    MarketInsightService,


    // Tính toán khả năng vay ngân hàng theo công thức PMT + tư vấn Gemini
    FinancingAdvisorService,
  ],
  // Export AiService để các module khác (nếu cần) có thể inject và dùng
  // ví dụ: gọi AI embedding hoặc chat từ module ngoài
  exports: [AiService],
})
export class AiModule {}
