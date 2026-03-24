import {
    Controller, Get, Post, Put, Delete,
    Param, Body, Query, UseGuards, ParseIntPipe,
    UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HouseService } from './house.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('houses')
export class HouseController {
    constructor(private readonly houseService: HouseService) { }

    @Get()
    findAll(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('search') search?: string,
    ) {
        if (search) return this.houseService.search(search, +page, +limit);
        return this.houseService.findAll(+page, +limit);
    }

    @Get('search')
    search(@Query('q') query: string, @Query('page') page = 1, @Query('limit') limit = 10) {
        return this.houseService.search(query, +page, +limit);
    }

    @Get(':id')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.houseService.findById(id);
    }

    @Post()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    @UseInterceptors(FilesInterceptor('images', 10))
    create(
        @Body() dto: CreateHouseDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.houseService.create(dto, files);
    }

    @Put(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    @UseInterceptors(FilesInterceptor('images', 10))
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateHouseDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.houseService.update(id, dto, files);
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.houseService.delete(id);
    }
}
