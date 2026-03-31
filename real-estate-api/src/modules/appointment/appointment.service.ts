import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
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
    house: {
        select: {
            id: true,
            title: true,
            city: true,
            district: true,
            images: { select: { id: true, url: true }, orderBy: { position: 'asc' as const }, take: 1 },
        },
    },
    land: {
        select: {
            id: true,
            title: true,
            city: true,
            district: true,
            images: { select: { id: true, url: true }, orderBy: { position: 'asc' as const }, take: 1 },
        },
    },
};

type AppointmentActor = {
    id: number;
    roles?: string[];
};

@Injectable()
export class AppointmentService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,          // dùng để lấy HTML template
        private mailProducer: MailProducerService, // dùng để publish lên RabbitMQ
    ) { }

    private isEmployeeRole(actor: AppointmentActor) {
        return Array.isArray(actor.roles) && actor.roles.includes('EMPLOYEE') && !actor.roles.includes('ADMIN');
    }

    private async resolveEmployeeIdByUser(userId: number) {
        const employee = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
        if (!employee) {
            throw new BadRequestException('Tài khoản nhân viên không hợp lệ');
        }
        return employee.id;
    }

    private buildFindAllWhere(search?: string, status?: number) {
        const andConditions: any[] = [];

        if (typeof status === 'number' && [0, 1, 2].includes(status)) {
            andConditions.push({ status });
        }

        if (search?.trim()) {
            const keyword = search.trim();
            andConditions.push({
                OR: [
                    { customer: { user: { fullName: { contains: keyword } } } },
                    { customer: { user: { email: { contains: keyword } } } },
                    { customer: { user: { phone: { contains: keyword } } } },
                    { guestName: { contains: keyword } },
                    { guestPhone: { contains: keyword } },
                    { guestEmail: { contains: keyword } },
                    { house: { title: { contains: keyword } } },
                    { land: { title: { contains: keyword } } },
                ],
            });
        }

        if (andConditions.length === 0) return {};
        if (andConditions.length === 1) return andConditions[0];

        return { AND: andConditions };
    }

    async findAll(page = 1, limit = 10, search?: string, status?: number) {
        const skip = (page - 1) * limit;
        const where = this.buildFindAllWhere(search, status);
        const statusCountWhere = this.buildFindAllWhere(search);

        const [appointments, total, groupedStatusCounts] = await Promise.all([
            this.prisma.appointment.findMany({
                where,
                skip,
                take: limit,
                include: appointmentInclude,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.appointment.count({ where }),
            this.prisma.appointment.groupBy({
                by: ['status'],
                where: statusCountWhere,
                _count: { _all: true },
            }),
        ]);

        const statusCounts = {
            all: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
        };

        for (const item of groupedStatusCounts) {
            const count = item._count._all;
            statusCounts.all += count;
            if (item.status === 0) statusCounts.pending = count;
            if (item.status === 1) statusCounts.approved = count;
            if (item.status === 2) statusCounts.rejected = count;
        }

        return {
            data: appointments,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            statusCounts,
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
                const fallbackEmail = `cus-${dto.newCustomerPhone}@local.invalid`;
                const newUser = await this.prisma.user.create({
                    data: {
                        username: `cus_${dto.newCustomerPhone}`,
                        password: hashPass,
                        fullName: dto.newCustomerName || '',
                        phone: dto.newCustomerPhone,
                        email: dto.newCustomerEmail?.trim() || fallbackEmail,
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
                status: 0,
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
            // Publish lên RabbitMQ – không block request
            this.mailProducer.sendMail(
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

        const nextAppointmentDate = dto.appointmentDate ? new Date(dto.appointmentDate) : appointment.appointmentDate;
        const nextEmployeeId = dto.employeeId !== undefined ? (dto.employeeId || null) : appointment.employeeId;
        const nextStatus = dto.status !== undefined ? dto.status : appointment.status;

        if (nextStatus === 1 && !nextEmployeeId) {
            throw new BadRequestException('Lịch hẹn đã duyệt phải có nhân viên phụ trách');
        }

        if (nextStatus === 1 && nextEmployeeId) {
            const conflict = await this.prisma.appointment.findFirst({
                where: {
                    employeeId: nextEmployeeId,
                    appointmentDate: nextAppointmentDate,
                    status: 1,
                    id: { not: id },
                },
            });
            if (conflict) {
                throw new BadRequestException('Nhân viên đã có lịch hẹn vào thời điểm này');
            }
        }

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
                ...(dto.appointmentDate && { appointmentDate: nextAppointmentDate }),
                ...(dto.employeeId !== undefined && { employeeId: nextEmployeeId }),
                ...(dto.status !== undefined && { status: nextStatus }),
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
            // Publish lên RabbitMQ – không block request
            this.mailProducer.sendMail(
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
            // Publish lên RabbitMQ – không block request
            this.mailProducer.sendMail(
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
            // Publish lên RabbitMQ – không block request
            this.mailProducer.sendMail(
                appointment.customer.user.email,
                'Lịch hẹn của bạn đã bị từ chối - BĐS',
                html,
            );
        }

        return { message: 'Từ chối lịch hẹn thành công', data: updated };
    }

    async findByEmployee(employeeId: number, actor: AppointmentActor) {
        let effectiveEmployeeId = employeeId;

        if (this.isEmployeeRole(actor)) {
            const selfEmployeeId = await this.resolveEmployeeIdByUser(actor.id);
            if (selfEmployeeId !== employeeId) {
                throw new ForbiddenException('Bạn chỉ được xem lịch hẹn của chính mình');
            }
            effectiveEmployeeId = selfEmployeeId;
        }

        return this.prisma.appointment.findMany({
            where: { employeeId: effectiveEmployeeId, status: 1 },
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

    async findMyAssignedAppointments(actor: AppointmentActor) {
        const employeeId = await this.resolveEmployeeIdByUser(actor.id);
        return this.findByEmployee(employeeId, { ...actor, roles: ['EMPLOYEE'] });
    }

    async updateActualStatus(id: number, dto: UpdateActualStatusDto, actor: AppointmentActor) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: { employee: { select: { id: true, userId: true } } },
        });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        if (appointment.status !== 1) {
            throw new BadRequestException('Chỉ có thể cập nhật trạng thái thực tế cho lịch hẹn đã duyệt');
        }
        if (!appointment.employeeId || !appointment.employee) {
            throw new BadRequestException('Lịch hẹn chưa được phân công nhân viên');
        }

        if (this.isEmployeeRole(actor)) {
            const selfEmployeeId = await this.resolveEmployeeIdByUser(actor.id);
            if (selfEmployeeId !== appointment.employeeId) {
                throw new ForbiddenException('Bạn chỉ được cập nhật lịch hẹn được phân công cho mình');
            }
        }

        const normalizedReason = dto.cancelReason?.trim();

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                actualStatus: dto.actualStatus,
                cancelReason: dto.actualStatus === 1 ? null : (normalizedReason || null),
            },
        });

        return { message: 'Cập nhật trạng thái thực tế thành công', data: updated };
    }
}