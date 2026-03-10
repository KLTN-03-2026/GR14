import {
    Controller, Get, Post, Put, Delete,
    Param, Body, Query, UseGuards, ParseIntPipe,
    UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { LandService } from './land.service';
import { CreateLandDto, UpdateLandDto } from './dto/land.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Multer } from 'multer';

@Controller('lands')
export class LandController {
    constructor(private readonly landService: LandService) { }

    @Get()
    findAll(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('search') search?: string,
    ) {
        if (search) return this.landService.search(search, +page, +limit);
        return this.landService.findAll(+page, +limit);
    }

    @Get('search')
    search(@Query('q') query: string, @Query('page') page = 1, @Query('limit') limit = 10) {
        return this.landService.search(query, +page, +limit);
    }

    @Get(':id')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.landService.findById(id);
    }

    @Post()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    @UseInterceptors(FilesInterceptor('images', 10))
    create(
        @Body() dto: CreateLandDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.landService.create(dto, files);
    }

    @Put(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    @UseInterceptors(FilesInterceptor('images', 10))
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateLandDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.landService.update(id, dto, files);
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN', 'EMPLOYEE')
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.landService.delete(id);
    }
}
