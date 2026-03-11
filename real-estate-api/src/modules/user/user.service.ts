import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async checkPhone(phone: string) {
        const user = await this.prisma.user.findUnique({
            where: { phone },
            select: { id: true, fullName: true, phone: true, email: true },
        });
        return { exists: !!user, user: user || null };
    }

    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    phone: true,
                    email: true,
                    address: true,
                    status: true,
                    createdAt: true,
                    userRoles: { include: { role: { select: { code: true, name: true } } } },
                },
            }),
            this.prisma.user.count(),
        ]);

        return {
            data: users,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };
    }

    async findById(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                fullName: true,
                phone: true,
                email: true,
                address: true,
                status: true,
                createdAt: true,
                userRoles: { include: { role: { select: { code: true, name: true } } } },
            },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async create(dto: CreateUserDto) {
        const existUser = await this.prisma.user.findUnique({ where: { username: dto.username } });
        if (existUser) throw new BadRequestException('Username already exists');

        if (dto.email) {
            const existEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (existEmail) throw new BadRequestException('Email already exists');
        }

        const hashPass = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                username: dto.username,
                password: hashPass,
                fullName: dto.fullName,
                phone: dto.phone,
                email: dto.email,
                address: dto.address,
                status: dto.status ?? 1,
            },
        });

        if (dto.roleIds?.length) {
            await this.prisma.userRole.createMany({
                data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })),
            });
        }

        return { message: 'User created successfully', data: user };
    }

    async update(id: number, dto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        const data: any = { ...dto };
        delete data.roleIds;

        if (dto.password) {
            data.password = await bcrypt.hash(dto.password, 10);
        }

        const updated = await this.prisma.user.update({ where: { id }, data });
        return { message: 'User updated successfully', data: updated };
    }

    async delete(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        await this.prisma.user.delete({ where: { id } });
        return { message: 'User deleted successfully' };
    }

    async changePassword(id: number, oldPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) throw new BadRequestException('Current password is incorrect');

        const hashPass = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id }, data: { password: hashPass } });

        return { message: 'Password changed successfully' };
    }
}
