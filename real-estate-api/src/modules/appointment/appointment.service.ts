import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { formatDateTime } from '../../common/utils/format-datetime';
import {
    CreateAppointmentDto,
    AdminCreateAppointmentDto,
    UpdateAppointmentDto,
    ApproveAppointmentDto,
    CancelAppointmentDto,
    AssignEmployeeDto,
    UpdateActualStatusDto,
} from './dto/appointment.dto';

const appointmentInclude = {
    employee: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    customer: { include: { user: { select: { id: true, fullName: true, phone: true, email: true } } } },
    house: { select: { id: true, title: true, city: true, district: true } },
    land: { select: { id: true, title: true, city: true, district: true } },
};

@Injectable()
export class AppointmentService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

    async findAll(page = 1, limit = 10, search?: string) {
        const skip = (page - 1) * limit;
        const where = search
            ? {
                OR: [
                    { customer: { user: { fullName: { contains: search } } } },
                    { customer: { user: { email: { contains: search } } } },
                    { customer: { user: { phone: { contains: search } } } },
                    { guestName: { contains: search } },
                    { guestPhone: { contains: search } },
                    { guestEmail: { contains: search } },
                    { house: { title: { contains: search } } },
                    { land: { title: { contains: search } } },
                ],
            }
            : {};

        const [appointments, total] = await Promise.all([
            this.prisma.appointment.findMany({
                where,
                skip,
                take: limit,
                include: appointmentInclude,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.appointment.count({ where }),
        ]);

        return {
            data: appointments,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        };
    }

    async findById(id: number) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: appointmentInclude,
        });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        return appointment;
    }

    async create(dto: CreateAppointmentDto, userId: number) {
        const customer = await this.prisma.customer.findUnique({ where: { userId } });
        if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

        if (!dto.houseId && !dto.landId) {
            throw new BadRequestException('Vui lòng chọn nhà hoặc đất');
        }

        const appointment = await this.prisma.appointment.create({
            data: {
                houseId: dto.houseId || null,
                landId: dto.landId || null,
                customerId: customer.id,
                employeeId: null,
                appointmentDate: new Date(dto.appointmentDate),
                status: 0,
            },
        });

        return { message: 'Đặt lịch hẹn thành công, đang chờ duyệt', data: appointment };
    }

    async adminCreate(dto: AdminCreateAppointmentDto) {
        if (!dto.houseId && !dto.landId) {
            throw new BadRequestException('Cần chọn nhà hoặc đất');
        }

        let resolvedCustomerId: number;

        if (dto.customerId) {
            // Option A: dùng khách hàng có sẵn
            const existing = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
            if (!existing) throw new BadRequestException('Khách hàng không tồn tại');
            resolvedCustomerId = dto.customerId;
        } else if (dto.newCustomerPhone) {
            // Option B: tạo hoặc tìm khách hàng theo SĐT
            const existingUser = await this.prisma.user.findUnique({ where: { phone: dto.newCustomerPhone } });

            if (existingUser) {
                // User đã tồn tại → kiểm tra có customer chưa
                const existingCustomer = await this.prisma.customer.findUnique({ where: { userId: existingUser.id } });
                if (existingCustomer) {
                    resolvedCustomerId = existingCustomer.id;
                } else {
                    // Có user nhưng chưa là customer → tạo customer
                    const count = await this.prisma.customer.count();
                    const newCustomer = await this.prisma.customer.create({
                        data: {
                            code: `CUS${String(count + 1).padStart(3, '0')}`,
                            userId: existingUser.id,
                        },
                    });
                    const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
                    if (customerRole) {
                        await this.prisma.userRole.upsert({
                            where: { userId_roleId: { userId: existingUser.id, roleId: customerRole.id } },
                            update: {},
                            create: { userId: existingUser.id, roleId: customerRole.id },
                        });
                    }
                    resolvedCustomerId = newCustomer.id;
                }
            } else {
                // Tạo mới user + customer
                const count = await this.prisma.customer.count();
                const code = `CUS${String(count + 1).padStart(3, '0')}`;
                const bcrypt = await import('bcrypt');
                const hashPass = await bcrypt.hash('customer123', 10);
                const newUser = await this.prisma.user.create({
                    data: {
                        username: `cus_${dto.newCustomerPhone}`,
                        password: hashPass,
                        fullName: dto.newCustomerName || '',
                        phone: dto.newCustomerPhone,
                        email: dto.newCustomerEmail || null,
                        status: 1,
                    },
                });
                const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
                if (customerRole) {
                    await this.prisma.userRole.create({ data: { userId: newUser.id, roleId: customerRole.id } });
                }
                const newCustomer = await this.prisma.customer.create({
                    data: { code, userId: newUser.id },
                });
                resolvedCustomerId = newCustomer.id;
            }
        } else {
            throw new BadRequestException('Vui lòng chọn khách hàng có sẵn hoặc nhập thông tin khách mới');
        }

        const appointment = await this.prisma.appointment.create({
            data: {
                houseId: dto.houseId || null,
                landId: dto.landId || null,
                customerId: resolvedCustomerId,
                employeeId: dto.employeeId || null,
                appointmentDate: new Date(dto.appointmentDate),
                status: dto.employeeId ? 1 : 0,
            },
            include: appointmentInclude,
        });

        // Gửi mail xác nhận
        const customerWithUser = await this.prisma.customer.findUnique({
            where: { id: resolvedCustomerId },
            include: { user: { select: { fullName: true, email: true } } },
        });
        const propertyTitle = appointment.house?.title || appointment.land?.title || '';
        if (customerWithUser?.user?.email) {
            const html = this.mailService.getConfirmationEmailHtml(
                customerWithUser.user.fullName || 'Quý khách',
                formatDateTime(new Date(dto.appointmentDate)),
                propertyTitle,
            );
            await this.mailService.sendEmail(
                customerWithUser.user.email,
                'Lịch hẹn của bạn đã được tạo - BĐS',
                html,
            );
        }

        return { message: 'Tạo lịch hẹn thành công', data: appointment };
    }

    async update(id: number, dto: UpdateAppointmentDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        const appointmentFull = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                customer: { include: { user: { select: { fullName: true, email: true } } } },
                house: { select: { title: true } },
                land: { select: { title: true } },
            },
        });

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                ...(dto.appointmentDate && { appointmentDate: new Date(dto.appointmentDate) }),
                ...(dto.employeeId !== undefined && { employeeId: dto.employeeId || null }),
                ...(dto.status !== undefined && { status: dto.status }),
            },
            include: appointmentInclude,
        });

        // Send cancellation email when status changed to 2
        if (dto.status === 2 && appointmentFull?.customer?.user?.email) {
            const propertyTitle = appointmentFull.house?.title || appointmentFull.land?.title || '';
            const html = this.mailService.getCancellationEmailHtml(
                appointmentFull.customer.user.fullName || 'Quý khách',
                formatDateTime(appointmentFull.appointmentDate),
                propertyTitle,
            );
            await this.mailService.sendEmail(
                appointmentFull.customer.user.email,
                'Lịch hẹn của bạn đã bị từ chối - BĐS',
                html,
            );
        }

        return { message: 'Cập nhật lịch hẹn thành công', data: updated };
    }

    async delete(id: number) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        await this.prisma.appointment.delete({ where: { id } });
        return { message: 'Xóa lịch hẹn thành công' };
    }

    async assignEmployee(id: number, dto: AssignEmployeeDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: { employeeId: dto.employeeId },
            include: appointmentInclude,
        });

        return { message: 'Phân công nhân viên thành công', data: updated };
    }

    async approve(id: number, dto: ApproveAppointmentDto) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                customer: {
                    include: { user: { select: { fullName: true, email: true } } },
                },
                house: { select: { title: true } },
                land: { select: { title: true } },
            },
        });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        const conflict = await this.prisma.appointment.findFirst({
            where: {
                employeeId: dto.employeeId,
                appointmentDate: appointment.appointmentDate,
                status: 1,
                id: { not: id },
            },
        });
        if (conflict) throw new BadRequestException('Nhân viên đã có lịch hẹn vào thời điểm này');

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: { employeeId: dto.employeeId, status: 1 },
            include: appointmentInclude,
        });

        if (appointment.customer?.user?.email) {
            const propertyTitle = appointment.house?.title || appointment.land?.title || '';
            const html = this.mailService.getApprovalEmailHtml(
                appointment.customer.user.fullName || 'Quý khách',
                formatDateTime(appointment.appointmentDate),
                propertyTitle,
            );
            await this.mailService.sendEmail(
                appointment.customer.user.email,
                'Lịch hẹn của bạn đã được duyệt - BĐS',
                html,
            );
        }

        return { message: 'Duyệt lịch hẹn thành công', data: updated };
    }

    async cancel(id: number, dto?: CancelAppointmentDto) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                customer: {
                    include: { user: { select: { fullName: true, email: true } } },
                },
                house: { select: { title: true } },
                land: { select: { title: true } },
            },
        });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        if (appointment.status === 2) throw new BadRequestException('Lịch hẹn đã bị từ chối trước đó');

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                status: 2,
                ...(dto?.cancelReason && { cancelReason: dto.cancelReason }),
            },
            include: appointmentInclude,
        });

        if (appointment.customer?.user?.email) {
            const propertyTitle = appointment.house?.title || appointment.land?.title || '';
            const html = this.mailService.getCancellationEmailHtml(
                appointment.customer.user.fullName || 'Quý khách',
                formatDateTime(appointment.appointmentDate),
                propertyTitle,
                dto?.cancelReason,
            );
            await this.mailService.sendEmail(
                appointment.customer.user.email,
                'Lịch hẹn của bạn đã bị từ chối - BĐS',
                html,
            );
        }

        return { message: 'Từ chối lịch hẹn thành công', data: updated };
    }

    async findByEmployee(employeeId: number) {
        return this.prisma.appointment.findMany({
            where: { employeeId, status: 1 },
            include: {
                customer: {
                    include: { user: { select: { fullName: true, phone: true } } },
                },
                house: {
                    select: { title: true, city: true, district: true, ward: true, street: true, houseNumber: true, price: true, area: true, direction: true },
                },
                land: {
                    select: { title: true, city: true, district: true, ward: true, street: true, plotNumber: true, price: true, area: true, direction: true },
                },
            },
        });
    }

    async updateActualStatus(id: number, dto: UpdateActualStatusDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                actualStatus: dto.actualStatus,
                cancelReason: dto.cancelReason,
            },
        });

        return { message: 'Cập nhật trạng thái thực tế thành công', data: updated };
    }
}