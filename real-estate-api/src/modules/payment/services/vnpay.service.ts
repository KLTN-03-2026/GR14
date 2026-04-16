import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VNPayService {
  private vnp_TmnCode: string;
  private vnp_HashSecret: string;
  private vnp_Url: string;
  private vnp_ReturnUrl: string;

  constructor(private configService: ConfigService) {
    this.vnp_TmnCode = this.requireEnv('VNPAY_TMN_CODE');
    this.vnp_HashSecret = this.requireEnv('VNPAY_HASH_SECRET');
    this.vnp_Url = this.requireEnv('VNPAY_URL');
    this.vnp_ReturnUrl = this.requireEnv('VNPAY_RETURN_URL');
  }

  createPaymentUrl(
    orderId: string,
    amount: number,
    orderInfo: string,
    ipAddr: string,
    returnUrl?: string,
  ): string {
    // VNPay yêu cầu thời gian theo múi giờ Việt Nam (GMT+7)
    const now = new Date();
    const createDate = this.formatDateTime(now);
    const expireDate = this.formatDateTime(
      new Date(now.getTime() + 30 * 60 * 1000),
    ); // 30 phút

    // Chuẩn hóa IP address - loại bỏ IPv6 prefix
    let cleanIp = ipAddr || '127.0.0.1';
    if (cleanIp.includes('::ffff:')) {
      cleanIp = cleanIp.replace('::ffff:', '');
    }

    const vnp_Params: Record<string, string | number> = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = this.vnp_TmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = Math.round(amount * 100);
    vnp_Params['vnp_ReturnUrl'] = returnUrl || this.vnp_ReturnUrl;
    vnp_Params['vnp_IpAddr'] = cleanIp;
    vnp_Params['vnp_CreateDate'] = createDate;
    vnp_Params['vnp_ExpireDate'] = expireDate;

    const sortedParams = this.sortObject(vnp_Params);

    const signData = Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&');

    const secureHash = this.createHmacSha512(signData, this.vnp_HashSecret);

    const paymentUrl = `${this.vnp_Url}?${signData}&vnp_SecureHash=${secureHash}`;

    return paymentUrl;
  }

  verifyReturnUrl(vnp_Params: Record<string, string>): {
    isValid: boolean;
    responseCode: string;
  } {
    const secureHash = vnp_Params['vnp_SecureHash'];

    const params = { ...vnp_Params };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(params);
    const signData = qs.stringify(sortedParams, { encode: false });
    const checkSum = this.createHmacSha512(signData, this.vnp_HashSecret);

    return {
      isValid: secureHash === checkSum,
      responseCode: vnp_Params['vnp_ResponseCode'],
    };
  }

  private formatDateTime(date: Date): string {
    const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const year = vnDate.getUTCFullYear();
    const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnDate.getUTCDate()).padStart(2, '0');
    const hour = String(vnDate.getUTCHours()).padStart(2, '0');
    const minute = String(vnDate.getUTCMinutes()).padStart(2, '0');
    const second = String(vnDate.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  private sortObject(
    obj: Record<string, string | number>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(obj[key])).replace(
        /%20/g,
        '+',
      );
      sorted[encodedKey] = encodedValue;
    }

    return sorted;
  }

  private createHmacSha512(data: string, secret: string): string {
    return crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');
  }

  private requireEnv(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }
}
