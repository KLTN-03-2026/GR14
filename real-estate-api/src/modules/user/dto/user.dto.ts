import { IsNotEmpty, IsString, IsOptional, IsEmail, IsInt, IsArray } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateUserDto {
    @IsNotEmpty()
    @IsString()
    username: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsInt()
    status?: number;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    roleIds?: number[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) { }
