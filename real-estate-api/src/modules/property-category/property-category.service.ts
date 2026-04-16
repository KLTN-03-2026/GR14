import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePropertyCategoryDto,
  UpdatePropertyCategoryDto,
} from './dto/property-category.dto';

@Injectable()
export class PropertyCategoryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.propertyCategory.findMany();
  }

  async findById(id: number) {
    const category = await this.prisma.propertyCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Property category not found');
    return category;
  }

  async create(dto: CreatePropertyCategoryDto) {
    const existing = await this.prisma.propertyCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new BadRequestException('Category code already exists');

    return this.prisma.propertyCategory.create({ data: dto });
  }

  async update(id: number, dto: UpdatePropertyCategoryDto) {
    const category = await this.prisma.propertyCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Property category not found');

    return this.prisma.propertyCategory.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const category = await this.prisma.propertyCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Property category not found');

    await this.prisma.propertyCategory.delete({ where: { id } });
    return { message: 'Property category deleted successfully' };
  }
}
