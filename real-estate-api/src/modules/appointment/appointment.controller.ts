import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
  ParseIntPipe,
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

@Controller('appointments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // Customer creates appointment
  @Post()
  @Roles('CUSTOMER')
  create(@Body() dto: CreateAppointmentDto, @Req() req: any) {
    return this.appointmentService.create(dto, req.user.id);
  }

  // Admin creates appointment
  @Post('admin')
  @Roles('ADMIN')
  adminCreate(@Body() dto: AdminCreateAppointmentDto) {
    return this.appointmentService.adminCreate(dto);
  }

  // Admin get all (paginated + search)
  @Get()
  @Roles('ADMIN')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const parsedStatus =
      status === undefined || status === '' ? undefined : Number(status);
    const safeStatus = Number.isNaN(parsedStatus) ? undefined : parsedStatus;
    return this.appointmentService.findAll(+page, +limit, search, safeStatus);
  }

  // Admin update (date, employee, status)
  @Put(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(id, dto);
  }

  // Admin delete
  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.delete(id);
  }

  // Admin approve + assign employee
  @Put(':id/approve')
  @Roles('ADMIN')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveAppointmentDto,
  ) {
    return this.appointmentService.approve(id, dto);
  }

  // Admin cancel with optional reason
  @Put(':id/cancel')
  @Roles('ADMIN')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentService.cancel(id, dto);
  }

  // Admin assign/reassign employee
  @Put(':id/assign')
  @Roles('ADMIN')
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
  moveCalendarAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveCalendarAppointmentDto,
  ) {
    return this.appointmentService.moveCalendarAppointment(id, dto);
  }

  // Admin get one
  @Get(':id')
  @Roles('ADMIN')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.findById(id);
  }

  @Put(':id/first-contact')
  @Roles('ADMIN', 'EMPLOYEE')
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
  updateActualStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActualStatusDto,
    @Req() req: any,
  ) {
    return this.appointmentService.updateActualStatus(id, dto, req.user);
  }
}
