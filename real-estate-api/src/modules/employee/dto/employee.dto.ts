import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateEmployeeDto {
    @IsNotEmpty()
    @IsString()
    code: string;

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
    startDate?: string;

}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) { }
