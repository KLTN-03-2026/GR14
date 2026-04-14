import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Ip,
  Res,
  DefaultValuePipe,
  Put
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, VNPayCallbackDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  // 1. GATEWAY CALLBACKS & IPN (VNPay gọi về)
  @Get('vnpay/callback')
  async vnpayCallback(@Query() query: VNPayCallbackDto, @Res() res: Response) {
    const result = await this.paymentService.handleVNPayCallback(query);
    const redirectUrl = result.success
      ? `${process.env.FRONTEND_URL}/payment/success`
      : `${process.env.FRONTEND_URL}/payment/failed`;
    return res.redirect(302, redirectUrl);
  }

  // THÊM MỚI: Route IPN cho VNPay update ngầm trạng thái
  @Get('vnpay/ipn')
  async vnpayIpn(@Query() query: any, @Res() res: Response) {
    const result = await this.paymentService.handleVNPayIPN(query);
    // VNPay yêu cầu trả về HTTP Status 200 kèm JSON format chuẩn của họ
    return res.status(200).json(result);
  }

  // 2. USER ROUTES
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Request() req,
    @Ip() ip: string,
  ) {
    return this.paymentService.createPayment(dto, req.user.id, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyPayments(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, // Đã fix parse pipe sạch hơn
  ) {
    return this.paymentService.getMyPayments(req.user.id, page);
  }

  // 3. DYNAMIC ROUTES (Luôn để cuối)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPaymentById(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.paymentService.getPaymentById(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/simulate-success')
  async simulateSuccess(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.paymentService.simulatePaymentSuccess(id, req.user.id);
  }
  @Put(':id/upgrade-vip')
  @UseGuards(JwtAuthGuard)
  upgradeToVip(@Param('id') id: string, @Request() req: any) {
     return this.paymentService.initiatePostVipUpgrade(Number(id), req.user.id);
  }
}
