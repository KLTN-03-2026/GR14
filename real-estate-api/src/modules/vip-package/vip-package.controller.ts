import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { VipPackageService } from './vip-package.service';
import {
  CreateVipPackageDto,
  UpdateVipPackageDto,
} from './dto/vip-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('vip-packages')
export class VipPackageController {
  constructor(private vipPackageService: VipPackageService) {}

  // ==================== PUBLIC ROUTES ====================

  @Get()
  async getAllPackages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vipPackageService.getAllPackages(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  // ==================== USER ROUTES (before :id to avoid route conflict) ====================

  @UseGuards(JwtAuthGuard)
  @Get('my/subscriptions')
  async getMySubscriptions(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vipPackageService.getMySubscriptions(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions/:id')
  async getSubscriptionById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.vipPackageService.getSubscriptionById(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions/:id/cancel')
  async cancelSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.vipPackageService.cancelSubscription(id, req.user.id);
  }

  // ==================== ADMIN ROUTES ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('admin/subscriptions')
  async getAllSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.vipPackageService.getAllSubscriptions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status ? parseInt(status) : undefined,
    );
  }

  @Get(':id')
  async getPackageById(@Param('id', ParseIntPipe) id: number) {
    return this.vipPackageService.getPackageById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post()
  async createPackage(@Body() dto: CreateVipPackageDto) {
    return this.vipPackageService.createPackage(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Put(':id')
  async updatePackage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVipPackageDto,
  ) {
    return this.vipPackageService.updatePackage(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  async deletePackage(@Param('id', ParseIntPipe) id: number) {
    return this.vipPackageService.deletePackage(id);
  }
}
