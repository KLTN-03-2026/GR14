import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DepositService } from './deposit.service';
import {
  CreateDepositRequestDto,
  RequestRefundDto,
  AdminProcessRefundDto,
  GetDepositsQueryDto,
  GetAdminRefundsQueryDto, // ← thêm import
} from './dto/deposit.dto';

@Controller('deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  // ── Static routes (phải đặt TRƯỚC :id) ───────────────────────────────────

  @Post()
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  async createDepositRequest(
    @Body() dto: CreateDepositRequestDto,
    @Req() req: any,
  ) {
    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      '127.0.0.1';

    return this.depositService.createDepositRequest(
      {
        appointmentId: dto.appointmentId,
        userId:        req.user.id,
        amount:        dto.amount,
        paymentMethod: dto.paymentMethod,
        returnUrl:     dto.returnUrl,
      },
      ipAddr,
    );
  }

  @Get('my')
  @Roles('CUSTOMER')
  async getMyDeposits(@Query() query: GetDepositsQueryDto, @Req() req: any) {
    return this.depositService.findByUser(+req.user.id, query.page, query.limit);
  }

  // ── ✅ THÊM MỚI: Admin xem danh sách yêu cầu hoàn tiền ──────────────────
  @Get('admin/refunds')
  @Roles('ADMIN')
  async getAdminRefunds(@Query() query: GetAdminRefundsQueryDto) {
    return this.depositService.findRefundRequests(
      query.page,
      query.limit,
      query.status,
    );
  }

  @Get()
  @Roles('ADMIN')
  async getAllDeposits(@Query() query: GetDepositsQueryDto) {
    return this.depositService.findAll(query.page, query.limit, query.status);
  }

  // ── Dynamic routes ────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('CUSTOMER', 'ADMIN')
  async getDepositById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const deposit = await this.depositService.findById(id);
    const isAdmin = (req.user.roles as string[])?.includes('ADMIN');
    if (!isAdmin && deposit.userId !== req.user.id) {
      throw new ForbiddenException('Bạn không có quyền xem giao dịch này');
    }
    return deposit;
  }

  @Post(':id/refund')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  async requestRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestRefundDto,
    @Req() req: any,
  ) {
    return this.depositService.requestRefund({
      depositId:         id,
      userId:            req.user.id,
      refundAccountInfo: dto.refundAccountInfo,
    });
  }

  // ── ✅ SỬA: truyền thêm adminNote ────────────────────────────────────────
  @Patch(':id/refund')
  @Roles('ADMIN')
  async adminProcessRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminProcessRefundDto,
  ) {
    return this.depositService.adminProcessRefund({
      depositId: id,
      approve:   dto.approve,
      adminNote: dto.adminNote, // ← thêm
    });
  }

  @Patch(':id/complete')
  @Roles('ADMIN')
  async completeDeposit(@Param('id', ParseIntPipe) id: number) {
    return this.depositService.completeDeposit({ depositId: id });
  }
}