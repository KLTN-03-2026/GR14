import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePostDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsString()
    city: string;

    @IsNotEmpty()
    @IsString()
    district: string;

    @IsNotEmpty()
    @IsString()
    ward: string;

    @IsNotEmpty()
    @IsString()
    address: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @IsString()           // ← đổi thành IsString
    price: string;        // ← đổi thành string

    @IsNotEmpty()
    @IsString()           // ← đổi thành IsString
    area: string;         // ← đổi thành string

    @IsOptional()
    @IsString()
    direction?: string;
}

// Update DTO
export class UpdatePostDto extends PartialType(CreatePostDto) {}