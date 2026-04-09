// src/modules/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ================= SUMMARY KPI =================

  @Get('summary')
  getSummary() {
    return this.analyticsService.getSummaryKPI();
  }

  // ================= USER =================

  /** GET /admin/analytics/users/growth?type=day|month|year */
  @Get('users/growth')
  getUserGrowth(@Query('type') type: string) {
    return this.analyticsService.getUserGrowth(type || 'month');
  }

  /** GET /admin/analytics/users/dau */
  @Get('users/dau')
  getDAU() {
    return this.analyticsService.getDAU();
  }

  /** GET /admin/analytics/users/mau */
  @Get('users/mau')
  getMAU() {
    return this.analyticsService.getMAU();
  }

  /** GET /admin/analytics/users/retention?days=1|7|30 */
  @Get('users/retention')
  getRetention(@Query('days') days: string) {
    return this.analyticsService.getRetention(Number(days) || 7);
  }

  // ================= POSTS =================

  /** GET /admin/analytics/posts/funnel */
  @Get('posts/funnel')
  getPostFunnel() {
    return this.analyticsService.getPostFunnel();
  }

  /** GET /admin/analytics/posts/time?type=day|month|year */
  @Get('posts/time')
  getPostTime(@Query('type') type: string) {
    return this.analyticsService.getPostByTime(type || 'month');
  }

  /** GET /admin/analytics/posts/approval-rate */
  @Get('posts/approval-rate')
  getApprovalRate() {
    return this.analyticsService.getApprovalRate();
  }

  /** GET /admin/analytics/posts/vip */
  @Get('posts/vip')
  getVip() {
    return this.analyticsService.getVipActive();
  }

  /** GET /admin/analytics/posts/vip-growth?type=day|month|year */
  @Get('posts/vip-growth')
  getVipGrowth(@Query('type') type: string) {
    return this.analyticsService.getVipGrowth(type || 'month');
  }

  // ================= REVENUE =================

  /** GET /admin/analytics/revenue?type=day|month|year */
  @Get('revenue')
  getRevenue(@Query('type') type: string) {
    return this.analyticsService.getRevenue(type || 'month');
  }

  /** GET /admin/analytics/revenue/transactions?type=day|month */
  @Get('revenue/transactions')
  getTransactions(@Query('type') type: string) {
    return this.analyticsService.getTransactionsByStatus(type || 'month');
  }

  /** GET /admin/analytics/revenue/gateway */
  @Get('revenue/gateway')
  getGateway() {
    return this.analyticsService.getRevenueByGateway();
  }

  /** GET /admin/analytics/revenue/package */
  @Get('revenue/package')
  getPackage() {
    return this.analyticsService.getRevenueByPackage();
  }

  /** GET /admin/analytics/revenue/top-spender */
  @Get('revenue/top-spender')
  getTopSpender() {
    return this.analyticsService.getTopSpenders();
  }

  // ================= APPOINTMENT =================

  /** GET /admin/analytics/appointments?type=day|month|year */
  @Get('appointments')
  getAppointments(@Query('type') type: string) {
    return this.analyticsService.getAppointments(type || 'month');
  }

  /** GET /admin/analytics/appointments/rates */
  @Get('appointments/rates')
  getAppointmentRates() {
    return this.analyticsService.getAppointmentRates();
  }

  /** GET /admin/analytics/appointments/performance */
  @Get('appointments/performance')
  getPerformance() {
    return this.analyticsService.getEmployeePerformance();
  }

  /** GET /admin/analytics/appointments/heatmap */
  @Get('appointments/heatmap')
  getHeatmap() {
    return this.analyticsService.getHeatmap();
  }

  // ================= BEHAVIOR =================

  /** GET /admin/analytics/favorites?type=day|month|year */
  @Get('favorites')
  getFavorites(@Query('type') type: string) {
    return this.analyticsService.getFavoriteTrend(type || 'month');
  }

  /** GET /admin/analytics/locations */
  @Get('locations')
  getLocations() {
    return this.analyticsService.getTopLocations();
  }

  /** GET /admin/analytics/compare */
  @Get('compare')
  compare() {
    return this.analyticsService.compareHouseLand();
  }

  /** GET /admin/analytics/compare/monthly */
  @Get('compare/monthly')
  compareMonthly() {
    return this.analyticsService.compareHouseLandMonthly();
  }
}
