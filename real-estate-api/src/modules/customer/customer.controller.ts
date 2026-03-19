import {
    Controller, Get, Post, Put, Delete,
    Param, Body, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerService } from './customer.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CustomerController {
    constructor(private readonly customerService: CustomerService) { }

    @Get()
        @Roles('ADMIN')
        findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
            return this.customerService.findAll(+page, +limit);
        }
    
        @Get(':id')
        @Roles('ADMIN', 'EMPLOYEE')
        findById(@Param('id', ParseIntPipe) id: number) {
            return this.customerService.findById(id);
        }
    
        @Post()
        @Roles('ADMIN')
        create(@Body() dto: CreateCustomerDto) {
            return this.customerService.create(dto);
        }
    
        @Put(':id')
        @Roles('ADMIN')
        update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
            return this.customerService.update(id, dto);
        }
    
        @Delete(':id')
        @Roles('ADMIN')
        delete(@Param('id', ParseIntPipe) id: number) {
            return this.customerService.delete(id);
        }
}

