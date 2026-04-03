import {
    Controller, Get, Post, Put, Delete,
    Param, Body, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmployeeService } from './employee.service';
import {
    CreateEmployeeDto,
    UpdateEmployeeDto,
} from './dto/employee.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) { }

    @Get()
    @Roles('ADMIN')
    findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
        return this.employeeService.findAll(+page, +limit);
    }

    @Get(':id')
    @Roles('ADMIN', 'EMPLOYEE')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.employeeService.findById(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() dto: CreateEmployeeDto) {
        return this.employeeService.create(dto);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
        return this.employeeService.update(id, dto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.employeeService.delete(id);
    }
}
