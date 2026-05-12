/**
 * @file generate-description.dto.ts
 * @description DTO cho API POST /ai/generate-description (tính năng VIP).
 *
 * Chứa thông tin bất động sản cần tạo mô tả. Hầu hết trường là optional —
 * chỉ cần 'tone' và 'postType' là bắt buộc.
 *
 * LOGIC XẬ LÝ trong DescriptionGeneratorService:
 *   1. Ghép tất cả các field có giá trị thành chuỗi `details`
 *   2. Tạo prompt Gemini với system role + tóm tắt toàn bộ thông tin
 *   3. Gemini sinh ra nội dung mô tả ~500-800 từ
 *   4. Fallback: nếu Gemini fail → buildTemplateDescription() (rule-based)
 *
 * LOẠI TIN ĐƯỢC HỘ TRỢ (postType):
 *   SELL_HOUSE  — Bán nhà, nhấn mạnh giá trị tài sản và thanh khoản
 *   SELL_LAND   — Bán đất, nhấn mạnh tiềm năng tăng giá và pháp lý
 *   RENT_HOUSE  — Cho thuê nhà/căn hộ/phòng trọ
 *   RENT_LAND   — Cho thuê đất/mặt bằng kinh doanh
 *   NEED_BUY    — Cần mua (viết từ góc nhìn người mua, không phải rao bán)
 *   NEED_RENT   — Cần thuê (viết từ góc nhìn người thuê)
 *   NEWS        — Tin tức BĐS trung lập
 *   PROMOTION   — Khuyến mãi (có mã giảm giá, thời gian)
 *
 * TONE (giọng điệu):
 *   'polite'   — Lịch sự, chuyên nghiệp, rõ ràng
 *   'friendly' — Thân thiện, gần gũi, dùng emoji vừa phải
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
} from 'class-validator';

/**
 * DescriptionGeneratorService nhận DTO này qua HTTP POST /ai/generate-description.
 * Gemini sẽ tạo nội dung mô tả ~500-800 từ dựa trên các trường được cung cấp.
 */
export class GenerateDescriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['polite', 'friendly'])
  tone!: 'polite' | 'friendly';

  @IsString()
  @IsNotEmpty()
  postType!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  area?: number;

  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @IsString()
  @IsOptional()
  direction?: string;

  @IsString()
  @IsOptional()
  legalStatus?: string;

  @IsNumber()
  @IsOptional()
  floors?: number;

  @IsNumber()
  @IsOptional()
  frontWidth?: number;

  @IsNumber()
  @IsOptional()
  landLength?: number;

  @IsString()
  @IsOptional()
  landType?: string;

  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @IsNumber()
  @IsOptional()
  minArea?: number;

  @IsNumber()
  @IsOptional()
  maxArea?: number;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  discountCode?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactLink?: string;
}
