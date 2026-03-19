import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty()
    @IsString()
    username!: string;

    @IsNotEmpty()
    @IsString()
    password!: string;

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    address?: string;
}

export class ConfirmRegisterDto extends RegisterDto {
    @IsNotEmpty()
    @IsString()
    otp!: string;
}
