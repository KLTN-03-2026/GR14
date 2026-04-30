import {
  IsInt,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepositRequestDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  appointmentId!: number;

  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['vnpay', 'momo', 'MOCK'])
  paymentMethod!: string;

  @IsString()
  @IsNotEmpty()
  returnUrl!: string;
}

export class RequestRefundDto {
  @IsString()
  @IsNotEmpty()
  refundAccountInfo!: string;
}

// ── Admin xử lý yêu cầu hoàn tiền ────────────────────────────────────────────

export class AdminProcessRefundDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()       // ← thêm
  @IsString()         // ← thêm
  adminNote?: string; // ← thêm
}

// ── Query params cho danh sách ────────────────────────────────────────────────

export class GetDepositsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  /**
   * Lọc theo status:
   * 0=pending, 1=paid, 2=refund_requested, 3=refunded, 4=expired, 5=completed
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

// ── Admin query danh sách hoàn tiền ──────────────────────────────────────────

export class GetAdminRefundsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  /**
   * Lọc theo status:
   * 2=refund_requested (chờ duyệt), 3=refunded (đã hoàn), 1=paid (từ chối hoàn)
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}