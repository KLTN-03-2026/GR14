import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomerService {
    constructor(private prisma: PrismaService) {}

    private genCode() {
        return `CUS${Math.floor(1000 + Math.random() * 9000)}`;
    }

    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.customer.findMany({
                skip,
                take: limit,
                orderBy: { id: 'desc' },
                include: { user: true },
            }),
            this.prisma.customer.count(),
        ]);

        return {
            data,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };
    }

    async findById(id: number) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!customer) throw new NotFoundException('Customer not found');
        return customer;
    }

    async create(dto: CreateCustomerDto) {
        return this.prisma.$transaction(async (tx) => {
            const exist = await tx.user.findUnique({
                where: { username: dto.username },
            });
            if (exist) throw new BadRequestException('Username already exists');

            const user = await tx.user.create({
                data: {
                    username: dto.username,
                    password: await bcrypt.hash(dto.password, 10),
                    fullName: dto.fullName,
                    phone: dto.phone,
                    email: dto.email,
                    address: dto.address,
                    status: 1,
                },
            });

            const role = await tx.role.findUnique({
                where: { code: 'CUSTOMER' },
            });

            if (role) {
                await tx.userRole.create({
                    data: { userId: user.id, roleId: role.id },
                });
            }

            let code = this.genCode();
            while (await tx.customer.findUnique({ where: { code } })) {
                code = this.genCode();
            }

            const customer = await tx.customer.create({
                data: { code, userId: user.id },
                include: { user: true },
            });

            return { message: 'Success', data: customer };
        });
    }

    async update(id: number, dto: UpdateCustomerDto) {
        const customer = await this.prisma.customer.findUnique({ where: { id } });
        if (!customer) throw new NotFoundException('Customer not found');

        await this.prisma.user.update({
            where: { id: customer.userId },
            data: dto,
        });

        return { message: 'Updated' };
    }

    async delete(id: number) {
    const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: { user: true }
    });

    if (!customer) {
        throw new NotFoundException('Customer not found');
    }

    // 🔥 update status user
    await this.prisma.user.update({
        where: { id: customer.userId },
        data: { status: 0 }
    });

        return { message: 'Disabled account customer' };
    }
}