import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export const PROPERTY_CATEGORY_TYPES = ['HOUSE', 'LAND'] as const;
export type PropertyCategoryType = (typeof PROPERTY_CATEGORY_TYPES)[number];

export class CreatePropertyCategoryDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(PROPERTY_CATEGORY_TYPES)
  categoryType: PropertyCategoryType;
}

export class UpdatePropertyCategoryDto extends PartialType(
  CreatePropertyCategoryDto,
) {}
