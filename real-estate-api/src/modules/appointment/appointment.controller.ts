import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
  Req,                    // ← Thêm import này
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentService } from './appointment.service';
import {
  CreateAppointmentDto,
  AdminCreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  CancelAppointmentDto,
  AssignEmployeeDto,
  MarkFirstContactDto,
  UpdateActualStatusDto,
  AppointmentCalendarQueryDto,
  MoveCalendarAppointmentDto,
} from './dto/appointment.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';

@Controller('appointments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // ====================== CUSTOMER ======================

  /** Khách hàng tạo lịch hẹn */
  @Post()
  @Roles('CUSTOMER')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.appointmentService.create(dto, userId);
  }

  /** Khách hàng xem danh sách lịch hẹn cá nhân (có thể lọc theo status) */
  @Get('me')
  @Roles('CUSTOMER')
  findMyAppointments(
    @CurrentUser('id') userId: number,
    @Query('status') status?: string,
  ) {
    const parsedStatus = status ? Number(status) : undefined;
    return this.appointmentService.findMyAppointments(userId, parsedStatus);
  }

  /** Khách hàng xem chi tiết một lịch hẹn của mình */
  @Get('me/:id')
  @Roles('CUSTOMER')
  findMyAppointmentById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.appointmentService.findMyAppointmentById(id, userId);
  }

  /** Khách hàng tự hủy lịch hẹn của mình */
  @Put('me/:id/cancel')
  @Roles('CUSTOMER')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  cancelMyAppointment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentService.cancelMyAppointment(id, userId, dto);
  }

  // ====================== ADMIN & EMPLOYEE ======================

  @Post('admin')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  adminCreate(@Body() dto: AdminCreateAppointmentDto) {
    return this.appointmentService.adminCreate(dto);
  }

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const parsedStatus = status ? Number(status) : undefined;
    const safeStatus = Number.isNaN(parsedStatus) ? undefined : parsedStatus;

    return this.appointmentService.findAll(page, limit, search, safeStatus);
  }

  @Put(':id')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.delete(id);
  }

  @Put(':id/approve')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveAppointmentDto,
  ) {
    return this.appointmentService.approve(id, dto);
  }

  @Put(':id/cancel')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentService.cancel(id, dto);
  }

  @Put(':id/assign')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  assignEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignEmployeeDto,
  ) {
    return this.appointmentService.assignEmployee(id, dto);
  }

  @Put(':id/auto-assign')
  @Roles('ADMIN')
  autoAssign(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.autoAssign(id, true);
  }

  @Get(':id/suggest-slots')
  @Roles('ADMIN')
  suggestSlots(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.suggestSlots(id);
  }

  @Get('calendar/events')
  @Roles('ADMIN')
  getCalendarEvents(@Query() query: AppointmentCalendarQueryDto) {
    return this.appointmentService.getCalendarEvents(query);
  }

  @Put(':id/calendar-move')
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  moveCalendarAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveCalendarAppointmentDto,
  ) {
    return this.appointmentService.moveCalendarAppointment(id, dto);
  }

  @Get(':id')
  @Roles('ADMIN')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.findById(id);
  }

  @Put(':id/first-contact')
  @Roles('ADMIN', 'EMPLOYEE')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  markFirstContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkFirstContactDto,
  ) {
    return this.appointmentService.markFirstContact(id, dto);
  }

  @Get('employee/:id')
  @Roles('ADMIN', 'EMPLOYEE')
  findByEmployee(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.appointmentService.findByEmployee(id, req.user);
  }

  @Get('me/assigned')
  @Roles('EMPLOYEE')
  findMyAssignedAppointments(@Req() req: any) {
    return this.appointmentService.findMyAssignedAppointments(req.user);
  }

  @Put(':id/actual-status')
  @Roles('ADMIN', 'EMPLOYEE')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateActualStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActualStatusDto,
    @Req() req: any,
  ) {
    return this.appointmentService.updateActualStatus(id, dto, req.user);
  }
}