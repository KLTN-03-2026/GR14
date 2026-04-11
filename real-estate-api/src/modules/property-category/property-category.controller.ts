import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PropertyCategoryService } from './property-category.service';
import {
  CreatePropertyCategoryDto,
  UpdatePropertyCategoryDto,
} from './dto/property-category.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('property-categories')
export class PropertyCategoryController {
  constructor(private readonly service: PropertyCategoryService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreatePropertyCategoryDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
