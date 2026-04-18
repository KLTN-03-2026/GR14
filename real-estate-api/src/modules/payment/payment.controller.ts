import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Ip,
  Res,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, VNPayCallbackDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) { }

  @Get('vnpay/callback')
  async vnpayCallback(@Query() query: VNPayCallbackDto, @Res() res: Response) {
    const result = await this.paymentService.handleVNPayCallback(query);
    const redirectUrl = result.success
      ? `${process.env.FRONTEND_URL}/payment/success`
      : `${process.env.FRONTEND_URL}/payment/failed`;
    return res.redirect(302, redirectUrl);
  }

  @Get('vnpay/ipn')
  async vnpayIpn(@Query() query: any, @Res() res: Response) {
    const result = await this.paymentService.handleVNPayIPN(query);
    return res.status(200).json(result);
  }

  @Get('momo/callback')
  async momoCallback(@Query() query: any, @Res() res: Response) {
    const result = await this.paymentService.handleMoMoCallback(query);
    const redirectUrl = result.success
      ? `${process.env.FRONTEND_URL}/payment/success?orderId=${query.orderId}`
      : `${process.env.FRONTEND_URL}/payment/failed?resultCode=${query.resultCode}`;
    return res.redirect(302, redirectUrl);
  }

  @Post('momo/notify')
async momoNotify(@Body() body: any, @Res() res: Response) {
  await this.paymentService.handleMoMoIPN(body);
  return res.status(200).json({ message: 'ok' });
}


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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.paymentService.getMyPayments(req.user.id, page, limit);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/all')
  async getAllPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentService.getAllPayments(page, limit, search, method, status, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/simulate-success')
  async simulateSuccess(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.paymentService.simulatePaymentSuccess(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/upgrade-vip')
  upgradeToVip(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.paymentService.initiatePostVipUpgrade(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPaymentById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.paymentService.getPaymentById(id, req.user.id);
  }
}