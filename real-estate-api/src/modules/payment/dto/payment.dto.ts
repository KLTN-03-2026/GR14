import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// ==================== ENUM ====================
export enum PaymentType {
    POST_VIP = 'POST_VIP',
    ACCOUNT_VIP = 'ACCOUNT_VIP',
}

export enum PaymentMethod {
    VNPAY = 'vnpay',
    MOMO = 'momo',
}

// ==================== CREATE PAYMENT DTO ====================
export class CreatePaymentDto {
    @IsNotEmpty()
    @IsEnum(PaymentType)
    paymentType: PaymentType;

    @IsOptional()
    @IsNumber({}, { message: 'postId phải là số' })
    @Type(() => Number)
    postId?: number;

    @IsNotEmpty()
    @IsNumber({}, { message: 'packageId phải là số' })
    @Type(() => Number)
    packageId: number;

    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @IsNotEmpty()
    @IsString()
    returnUrl: string;
}

// ==================== VNPAY CALLBACK DTO ====================
export class VNPayCallbackDto {
    @IsOptional()
    @IsString()
    vnp_TmnCode?: string;

    @IsOptional()
    @IsString()
    vnp_Amount?: string;

    @IsOptional()
    @IsString()
    vnp_BankCode?: string;

    @IsOptional()
    @IsString()
    vnp_BankTranNo?: string;

    @IsOptional()
    @IsString()
    vnp_CardType?: string;

    @IsOptional()
    @IsString()
    vnp_PayDate?: string;

    @IsOptional()
    @IsString()
    vnp_OrderInfo?: string;

    @IsOptional()
    @IsString()
    vnp_TransactionNo?: string;

    @IsOptional()
    @IsString()
    vnp_ResponseCode?: string;

    @IsOptional()
    @IsString()
    vnp_TransactionStatus?: string;

    @IsOptional()
    @IsString()
    vnp_TxnRef?: string;

    @IsOptional()
    @IsString()
    vnp_SecureHash?: string;
}