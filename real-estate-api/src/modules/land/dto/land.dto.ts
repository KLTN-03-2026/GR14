import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateLandDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  plotNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  price?: any;

  @IsOptional()
  area?: any;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  frontWidth?: any;

  @IsOptional()
  landLength?: any;

  @IsOptional()
  @IsString()
  landType?: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  categoryId?: any;

  @IsOptional()
  employeeId?: any;
}

export class UpdateLandDto extends PartialType(CreateLandDto) {
  @IsOptional()
  status?: number;

  @IsOptional()
  keepImageIds?: any; // ID các ảnh cũ cần giữ lại
}
