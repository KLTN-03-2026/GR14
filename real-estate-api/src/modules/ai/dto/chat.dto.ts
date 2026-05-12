/**
 * @file chat.dto.ts
 * @description DTO (Data Transfer Object) cho API POST /ai/chat.
 *
 * Đây là schema validate dữ liệu đầu vào khi Frontend gửi câu hỏi đến chatbot.
 * class-validator sẽ tự động kiểm tra và trả 400 nếu vi phạm constraint.
 *
 * CÁC TRƯỜNG:
 *   sessionId — Mả phiên âm dầu (sạng tạo phía client, ví dụ: UUID v4)
 *               Redis dùng sessionId này làm key lưu:
 *                 - ai:memory:{sessionId}      → Lịch sử hội thoại (20 turns)
 *                 - ai:summary:{sessionId}     → Tóm tắt ngữ cảnh (1000 chars)
 *                 - ai:profile:{sessionId}     → Hồ sơ người dùng (7 ngày)
 *                 - ai:market:{area}           → Dữ liệu thống kê thị trường (1h)
 *
 *              Hỗ trợ tiếng Việt, kể cả tiếng lóng — LLM sẽ mở rộng thành expandedQuery
 */
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** DTO chứa thông tin cần thiết để gửi một lượt chat tới chatbot BĐS. */
export class ChatDto {
  /** ID phiên âm dầu — client tự sinh (UUID) và gửi kèm mọi request để duy trì ngữ cảnh */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sessionId!: string;

  /** Câu hỏi của người dùng — có thể viết tiếng lóng, không dấu — LLM sẽ hiểu và chuẩn hóa */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;
}
