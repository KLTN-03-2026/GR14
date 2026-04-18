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
  UploadedFiles,
  UseInterceptors,
  Req,
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
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedStatus = status ? Number(status) : undefined;
    const parsedCategoryId =
      categoryId !== undefined && categoryId !== ''
        ? Number(categoryId)
        : undefined;

    if (search)
      return this.landService.search(
        search,
        +page,
        +limit,
        parsedStatus,
        parsedCategoryId,
      );

    return this.landService.findAll(
      +page,
      +limit,
      parsedStatus,
      parsedCategoryId,
    );
  }

  @Get('search')
  search(
    @Query('q') query: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.landService.search(query, +page, +limit);
  }

  @Get('me/assigned')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('EMPLOYEE')
  findMyAssigned(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedStatus = status ? Number(status) : undefined;
    const parsedCategoryId =
      categoryId !== undefined && categoryId !== ''
        ? Number(categoryId)
        : undefined;
    return this.landService.findMyAssigned(req.user.id, +page, +limit, parsedStatus, parsedCategoryId);
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
