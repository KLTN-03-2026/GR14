import {
    Controller, Get, Post, Put, Delete,
    Param, Body, Req, Query,
    UseGuards, ParseIntPipe,
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
    UpdateActualStatusDto,
} from './dto/appointment.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('appointments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) { }

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
    ) {
        return this.appointmentService.findAll(+page, +limit, search);
    }

    // Admin get one
    @Get(':id')
    @Roles('ADMIN')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.appointmentService.findById(id);
    }

    // Admin update (date, employee, status)
    @Put(':id')
    @Roles('ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAppointmentDto) {
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
    approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveAppointmentDto) {
        return this.appointmentService.approve(id, dto);
    }

    // Admin cancel with optional reason
    @Put(':id/cancel')
    @Roles('ADMIN')
    cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelAppointmentDto) {
        return this.appointmentService.cancel(id, dto);
    }

    // Admin assign/reassign employee
    @Put(':id/assign')
    @Roles('ADMIN')
    assignEmployee(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignEmployeeDto) {
        return this.appointmentService.assignEmployee(id, dto);
    }

    @Get('employee/:id')
    @Roles('ADMIN', 'EMPLOYEE')
    findByEmployee(@Param('id', ParseIntPipe) id: number) {
        return this.appointmentService.findByEmployee(id);
    }

    @Put(':id/actual-status')
    @Roles('ADMIN', 'EMPLOYEE')
    updateActualStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActualStatusDto) {
        return this.appointmentService.updateActualStatus(id, dto);
    }
}
