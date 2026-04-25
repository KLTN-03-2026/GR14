import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class CreateHouseDto {
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
  houseNumber?: string;

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
  floors?: any;

  @IsOptional()
  bedrooms?: any;

  @IsOptional()
  bathrooms?: any;

  @IsOptional()
  categoryId?: any;

  @IsOptional()
  employeeId?: any;

  @IsOptional()
  status?: any;
}

export class UpdateHouseDto extends PartialType(CreateHouseDto) {
  @IsOptional()
  status?: number;

  @IsOptional()
  keepImageIds?: any; // ID các ảnh cũ cần giữ lại
}
