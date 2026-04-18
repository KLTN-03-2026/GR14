import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findById(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new BadRequestException('Role code already exists');

    return this.prisma.role.create({ data: dto });
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }
}
