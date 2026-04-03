import { IsNotEmpty, IsString, IsOptional, IsEmail, IsInt, Min, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateEmployeeDto {
    @IsNotEmpty()
    @IsString()
    code!: string;

    @IsNotEmpty()
    @IsString()
    username!: string;

    @IsNotEmpty()
    @IsString()
    password!: string;

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsNotEmpty()
    @IsString()
    phone!: string;

    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    ward?: string;

    @IsOptional()
    @IsString()
    district?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    maxAppointmentsPerDay?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) { }
