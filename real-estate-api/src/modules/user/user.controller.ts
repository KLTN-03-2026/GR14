import {
    Controller, Get, Post, Put, Delete, Param, Body, Query,
    UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('check-phone')
    @Roles('ADMIN')
    checkPhone(@Query('phone') phone: string) {
        return this.userService.checkPhone(phone);
    }

    @Get()
    @Roles('ADMIN')
    findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
        return this.userService.findAll(+page, +limit);
    }

    @Get(':id')
    @Roles('ADMIN')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.userService.findById(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() dto: CreateUserDto) {
        return this.userService.create(dto);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
        return this.userService.update(id, dto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.userService.delete(id);
    }
}
