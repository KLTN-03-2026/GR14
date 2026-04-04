import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

enum PaymentMethod {
    VNPAY = 'vnpay',
    MOMO = 'momo',
}

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    postId: number;

    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    packageId: number;

    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod; // 'vnpay' or 'momo'

    @IsNotEmpty()
    @IsString()
    returnUrl: string; // URL để redirect sau khi thanh toán
}

export class VNPayCallbackDto {
    @IsOptional()
    @IsString()
    vnp_TmnCode: string;

    @IsOptional()
    @IsString()
    vnp_Amount: string;

    @IsOptional()
    @IsString()
    vnp_BankCode: string;

    @IsOptional()
    @IsString()
    vnp_BankTranNo: string;

    @IsOptional()
    @IsString()
    vnp_CardType: string;

    @IsOptional()
    @IsString()
    vnp_PayDate: string;

    @IsOptional()
    @IsString()
    vnp_OrderInfo: string;

    @IsOptional()
    @IsString()
    vnp_TransactionNo: string;

    @IsOptional()
    @IsString()
    vnp_ResponseCode: string;

    @IsOptional()
    @IsString()
    vnp_TransactionStatus: string;

    @IsOptional()
    @IsString()
    vnp_TxnRef: string;

    @IsOptional()
    @IsString()
    vnp_SecureHashType: string;

    @IsOptional()
    @IsString()
    vnp_SecureHash: string;
}

export class MoMoCallbackDto {
    @IsOptional()
    @IsString()
    partnerCode: string;

    @IsOptional()
    @IsString()
    orderId: string;

    @IsOptional()
    @IsString()
    requestId: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    amount: number;

    @IsOptional()
    @IsString()
    orderInfo: string;

    @IsOptional()
    @IsString()
    orderType: string;

    @IsOptional()
    @IsString()
    transId: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    resultCode: number;

    @IsOptional()
    @IsString()
    message: string;

    @IsOptional()
    @IsString()
    payType: string;

    @IsOptional()
    @IsString()
    responseTime: string;

    @IsOptional()
    @IsString()
    extraData: string;

    @IsOptional()
    @IsString()
    signature: string;
}
