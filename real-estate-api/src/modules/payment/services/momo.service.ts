import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MoMoService {
  private readonly logger = new Logger(MoMoService.name);
  private partnerCode: string;
  private accessKey: string;
  private secretKey: string;
  private endpoint: string;
  private returnUrl: string;
  private notifyUrl: string;

  constructor(private configService: ConfigService) {
    this.partnerCode = (this.configService.get('MOMO_PARTNER_CODE') || '').trim();
    this.accessKey = (this.configService.get('MOMO_ACCESS_KEY') || '').trim();
    this.secretKey = (this.configService.get('MOMO_SECRET_KEY') || '').trim();
    this.endpoint =
      (this.configService.get('MOMO_ENDPOINT') ||
      'https://test-payment.momo.vn/v2/gateway/api/create').trim();
    this.returnUrl =
      (this.configService.get('MOMO_RETURN_URL') ||
      'http://localhost:3000/api/payment/momo/callback').trim();
    this.notifyUrl =
      (this.configService.get('MOMO_NOTIFY_URL') ||
      'http://localhost:3000/api/payment/momo/notify').trim();

    this.logger.debug(`MoMo config: partnerCode="${this.partnerCode}" accessKey="${this.accessKey}" endpoint="${this.endpoint}"`);
  }

  async createPaymentUrl(
    orderId: string,
    amount: number,
    orderInfo: string,
    returnUrl?: string,
  ): Promise<{ payUrl: string; deeplink: string; qrCodeUrl: string }> {
    const requestId = orderId;
    const extraData = '';
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${returnUrl || this.returnUrl}&requestId=${requestId}&requestType=payWithMethod`;

    this.logger.debug(`MoMo rawSignature: ${rawSignature}`);

    const signature = this.createHmacSha256(rawSignature, this.secretKey);

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'Test',
      storeId: 'MomoTestStore',
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: returnUrl || this.returnUrl,
      ipnUrl: this.notifyUrl,
      lang: lang,
      requestType: 'payWithMethod',
      autoCapture: autoCapture,
      extraData: extraData,
      orderGroupId: orderGroupId,
      signature: signature,
    };

    this.logger.debug(`MoMo requestBody: ${JSON.stringify(requestBody)}`);

    try {
      const response = await axios.post(this.endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.debug(`MoMo response: ${JSON.stringify(response.data)}`);

      if (response.data.resultCode === 0) {
        return {
          payUrl: response.data.payUrl,
          deeplink: response.data.deeplink,
          qrCodeUrl: response.data.qrCodeUrl,
        };
      } else {
        throw new Error(`MoMo error: ${response.data.message}`);
      }
    } catch (error) {
      if (error.response) {
        this.logger.error(`MoMo API error: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to create MoMo payment: ${error.message}`);
    }
  }


  verifySignature(data: any): boolean {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = data;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const calculatedSignature = this.createHmacSha256(
      rawSignature,
      this.secretKey,
    );

    return signature === calculatedSignature;
  }

  private createHmacSha256(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
