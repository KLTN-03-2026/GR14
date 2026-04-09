import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export enum PostType {
    SELL_HOUSE = 'SELL_HOUSE',
    SELL_LAND = 'SELL_LAND',
    RENT_HOUSE = 'RENT_HOUSE',
    RENT_LAND = 'RENT_LAND',
    NEED_BUY = 'NEED_BUY',
    NEED_RENT = 'NEED_RENT',
    NEWS = 'NEWS',
    PROMOTION = 'PROMOTION',
}

export class CreatePostDto {
    @IsNotEmpty()
    @IsEnum(PostType)
    postType!: PostType;

    @IsNotEmpty()
    @IsString()
    title!: string;

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
    address?: string;

    @IsOptional()
    @IsString()
    contactPhone?: string;

    @IsOptional()
    @IsString()
    contactLink?: string;

    @IsNotEmpty()
    @IsString()
    description!: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    price?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    area?: number;

    @IsOptional()
    @IsString()
    direction?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    bedrooms?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    bathrooms?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    floors?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    frontWidth?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    landLength?: number;

    @IsOptional()
    @IsString()
    landType?: string;

    @IsOptional()
    @IsString()
    legalStatus?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    maxPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    minArea?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    maxArea?: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    discountCode?: string;
}

export class UpdatePostDto extends PartialType(CreatePostDto) { }

export class PostResponseDto {
    id!: number;
    postType!: PostType;
    title!: string;
    city?: string;
    district?: string;
    ward?: string;
    address?: string;
    contactPhone?: string;
    contactLink?: string;
    description!: string;

    price?: number;
    area?: number;
    direction?: string;

    bedrooms?: number;
    bathrooms?: number;
    floors?: number;

    frontWidth?: number;
    landLength?: number;
    landType?: string;
    legalStatus?: string;

    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;

    startDate?: Date;
    endDate?: Date;
    discountCode?: string;

    status!: number;
    isVip!: boolean;
    vipExpiry?: Date;

    userId!: number;
    postedAt!: Date;
    approvedAt?: Date;
    createdAt!: Date;
    updatedAt!: Date;

    images?: { id: number; url: string; position: number }[];
    user?: {
        id: number;
        username: string;
        fullName: string;
        phone: string;
    };
}