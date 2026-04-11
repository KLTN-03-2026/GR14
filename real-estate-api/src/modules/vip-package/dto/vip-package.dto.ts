import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVipPackageDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  durationDays: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  priorityLevel: number;

  @IsOptional()
  @IsString()
  features?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  status?: number;
}

export class UpdateVipPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  priorityLevel?: number;

  @IsOptional()
  @IsString()
  features?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  status?: number;
}

export class CreateVipSubscriptionDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  postId: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  packageId: number;

  @IsNotEmpty()
  @IsString()
  paymentMethod: string; // 'vnpay' or 'momo'
}
