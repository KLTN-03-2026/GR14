import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
} from 'class-validator';

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
