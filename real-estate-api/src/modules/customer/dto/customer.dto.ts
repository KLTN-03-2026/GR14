import { IsNotEmpty, IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
export class CreateCustomerDto {
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
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
    @IsOptional()
    @IsBoolean()
    isVip?: boolean;
}