import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
    constructor(private prisma: PrismaService) { }

    private throwFriendlyUniqueError(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = String(error.meta?.target || '');

            if (target.includes('users_phone_key')) {
                throw new BadRequestException('Số điện thoại đã tồn tại');
            }
            if (target.includes('users_email_key')) {
                throw new BadRequestException('Email đã tồn tại');
            }
            if (target.includes('users_username_key')) {
                throw new BadRequestException('Tên đăng nhập đã tồn tại');
            }
            if (target.includes('employees_employee_code_key')) {
                throw new BadRequestException('Mã nhân viên đã tồn tại');
            }

            throw new BadRequestException('Dữ liệu đã tồn tại trong hệ thống');
        }

        throw error;
    }

    private normalizeOptional(value?: string | null) {
        if (typeof value !== 'string') return value ?? undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private ensureNotBlank(value: string | undefined, label: string) {
        if (value !== undefined && value.trim().length === 0) {
            throw new BadRequestException(`${label} không được để trống`);
        }
    }

    private async ensureUniqueUserFields(options: {
        username?: string;
        email?: string;
        phone?: string;
        excludeUserId?: number;
    }) {
        const { username, email, phone, excludeUserId } = options;

        if (username !== undefined) {
            const existedUsername = await this.prisma.user.findUnique({ where: { username } });
            if (existedUsername && existedUsername.id !== excludeUserId) {
                throw new BadRequestException('Tên đăng nhập đã tồn tại');
            }
        }

        if (email !== undefined) {
            const existedEmail = await this.prisma.user.findUnique({ where: { email } });
            if (existedEmail && existedEmail.id !== excludeUserId) {
                throw new BadRequestException('Email đã tồn tại');
            }
        }

        if (phone !== undefined) {
            const existedPhone = await this.prisma.user.findUnique({ where: { phone } });
            if (existedPhone && existedPhone.id !== excludeUserId) {
                throw new BadRequestException('Số điện thoại đã tồn tại');
            }
        }
    }

    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [employees, total] = await Promise.all([
            this.prisma.employee.findMany({
                skip,
                take: limit,
                include: {
                    user: {
                        select: { id: true, username: true, fullName: true, phone: true, email: true, status: true },
                    },
                },
            }),
            this.prisma.employee.count(),
        ]);

        return {
            data: employees,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };
    }

    async findById(id: number) {
        const employee = await this.prisma.employee.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, username: true, fullName: true, phone: true, email: true, status: true },
                },
            },
        });
        if (!employee) throw new NotFoundException('Employee not found');
        return employee;
    }
    private validateStartDate(date: string) {
        const startDate = new Date(date);
        const today = new Date();

        // reset giờ để chỉ so sánh ngày
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (startDate > today) {
            throw new BadRequestException(
                "Ngày vào làm không được lớn hơn ngày hiện tại"
            );
        }
    }
    async create(dto: CreateEmployeeDto) {
        this.ensureNotBlank(dto.code, 'Mã nhân viên');
        this.ensureNotBlank(dto.username, 'Tên đăng nhập');
        this.ensureNotBlank(dto.password, 'Mật khẩu');
        this.ensureNotBlank(dto.phone, 'Số điện thoại');
        this.ensureNotBlank(dto.email, 'Email');

        const normalizedUsername = dto.username.trim();
        const normalizedEmail = this.normalizeOptional(dto.email);
        const normalizedPhone = this.normalizeOptional(dto.phone);

        if (!normalizedPhone) {
            throw new BadRequestException('Số điện thoại không được để trống');
        }
        if (!normalizedEmail) {
            throw new BadRequestException('Email không được để trống');
        }

        await this.ensureUniqueUserFields({
            username: normalizedUsername,
            email: normalizedEmail,
            phone: normalizedPhone,
        });

        const existCode = await this.prisma.employee.findUnique({ where: { code: dto.code } });
        if (dto.startDate) {
            this.validateStartDate(dto.startDate);
        }

        if (existCode) {
            throw new BadRequestException('Mã nhân viên đã tồn tại');
        }

        const hashPass = await bcrypt.hash(dto.password, 10);

        let user;
        try {
            user = await this.prisma.user.create({
                data: {
                    username: normalizedUsername,
                    password: hashPass,
                    fullName: dto.fullName,
                    phone: normalizedPhone,
                    email: normalizedEmail,
                    status: 1,
                },
            });
        } catch (error) {
            this.throwFriendlyUniqueError(error);
        }

        const empRole = await this.prisma.role.findUnique({
            where: { code: 'EMPLOYEE' },
        });

        if (empRole) {
            await this.prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: empRole.id,
                },
            });
        }

        const employee = await this.prisma.employee.create({
            data: {
                code: dto.code,
                startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
                userId: user.id,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        phone: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });

        return {
            message: 'Employee created successfully',
            data: employee,
        };
    }

    async update(id: number, dto: UpdateEmployeeDto) {

        const employee = await this.prisma.employee.findUnique({
            where: { id },
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        this.ensureNotBlank(dto.code, 'Mã nhân viên');
        this.ensureNotBlank(dto.username, 'Tên đăng nhập');
        this.ensureNotBlank(dto.password, 'Mật khẩu');
        this.ensureNotBlank(dto.phone, 'Số điện thoại');
        this.ensureNotBlank(dto.email, 'Email');

        const normalizedUsername = this.normalizeOptional(dto.username);
        const normalizedEmail = this.normalizeOptional(dto.email);
        const normalizedPhone = this.normalizeOptional(dto.phone);

        await this.ensureUniqueUserFields({
            username: normalizedUsername,
            email: normalizedEmail,
            phone: normalizedPhone,
            excludeUserId: employee.userId,
        });

        if (dto.code) {
            const existedCode = await this.prisma.employee.findUnique({ where: { code: dto.code } });
            if (existedCode && existedCode.id !== id) {
                throw new BadRequestException('Mã nhân viên đã tồn tại');
            }
        }

        // Update thông tin user
        const userData: any = {};

        if (dto.fullName) userData.fullName = dto.fullName;
        if (dto.username !== undefined) userData.username = normalizedUsername;
        if (dto.phone !== undefined) userData.phone = normalizedPhone;
        if (dto.email !== undefined) userData.email = normalizedEmail;

        if (dto.password) {
            userData.password = await bcrypt.hash(dto.password, 10);
        }


        if (dto.startDate) {
            this.validateStartDate(dto.startDate);
        }


        if (Object.keys(userData).length > 0) {
            try {
                await this.prisma.user.update({
                    where: { id: employee.userId },
                    data: userData,
                });
            } catch (error) {
                this.throwFriendlyUniqueError(error);
            }
        }

        const updatedEmployee = await this.prisma.employee.update({
            where: { id },
            data: {
                ...(dto.code && { code: dto.code }),
                ...(dto.startDate && { startDate: new Date(dto.startDate) }),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        phone: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });

        return {
            message: 'Employee updated successfully',
            data: updatedEmployee,
        };
    }

    async delete(id: number) {
        const employee = await this.prisma.employee.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        await this.prisma.user.update({
            where: { id: employee.userId },
            data: { status: 0 }
        });

        return { message: 'Disabled account employee' };
    }
}