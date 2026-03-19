import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class ForgotPasswordDto {
    @IsNotEmpty()
    @IsEmail()
    email!: string;
}

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsNotEmpty()
    @IsString()
    otp!: string;

    @IsNotEmpty()
    @IsString()
    newPassword!: string;
}
