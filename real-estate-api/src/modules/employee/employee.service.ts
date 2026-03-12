import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
    constructor(private prisma: PrismaService) { }
    
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

        const existUser = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });
        if (dto.startDate) {
            this.validateStartDate(dto.startDate);
        }

        if (existUser) {
            throw new BadRequestException('Username already exists');
        }
    
        const hashPass = await bcrypt.hash(dto.password, 10);
    
        const user = await this.prisma.user.create({
            data: {
                username: dto.username,
                password: hashPass,
                fullName: dto.fullName,
                phone: dto.phone,
                email: dto.email,
                status: 1,
            },
        });
    
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
    
        // Update thông tin user
        const userData: any = {};
    
        if (dto.fullName) userData.fullName = dto.fullName;
        if (dto.phone) userData.phone = dto.phone;
        if (dto.email) userData.email = dto.email;
    
        if (dto.password) {
            userData.password = await bcrypt.hash(dto.password, 10);
        }

       
        if (dto.startDate) {
            this.validateStartDate(dto.startDate);
        }
    
    
        if (Object.keys(userData).length > 0) {
            await this.prisma.user.update({
                where: { id: employee.userId },
                data: userData,
            });
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
        });
    
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }
    
        await this.prisma.user.update({
            where: { id: employee.userId },
            data: {
                status: 0,
            },
        });
    
        return {
            message: 'Employee disabled successfully',
        };
    }
}