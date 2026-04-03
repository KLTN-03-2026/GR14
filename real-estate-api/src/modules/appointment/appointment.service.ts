import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { formatDateTime } from '../../common/utils/format-datetime';
import { AppointmentAutoAssignProducerService } from './appointment-auto-assign.producer';
import {
    CreateAppointmentDto,
    AdminCreateAppointmentDto,
    UpdateAppointmentDto,
    ApproveAppointmentDto,
    CancelAppointmentDto,
    AssignEmployeeDto,
    MarkFirstContactDto,
    UpdateActualStatusDto,
    AppointmentCalendarQueryDto,
    MoveCalendarAppointmentDto,
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

const SLA_STATUS = {
    ON_TRACK: 0,
    AT_RISK: 1,
    BREACHED: 2,
} as const;

const WORKING_HOURS = {
    morningStartHour: 8,
    morningStartMinute: 0,
    morningEndHour: 12,
    morningEndMinute: 0,
    afternoonStartHour: 13,
    afternoonStartMinute: 30,
    afternoonEndHour: 17,
    afternoonEndMinute: 30,
    slotMinutes: 30,
};

const BUSINESS_TIMEZONE_OFFSET_MINUTES = 7 * 60;

type AutoAssignCandidate = {
    employeeId: number;
    score: number;
    reason: string;
};

@Injectable()
export class AppointmentService implements OnModuleInit, OnModuleDestroy {
    private slaTimer: NodeJS.Timeout | null = null;
    private readonly logger = new Logger(AppointmentService.name);

    // Khởi tạo các dependency dùng cho logic lịch hẹn, mail và auto-assign.
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,          // dùng để lấy HTML template
        private mailProducer: MailProducerService, // dùng để publish lên RabbitMQ
        private autoAssignProducer: AppointmentAutoAssignProducerService,
    ) { }

    // Tạo timer chạy nền để cập nhật SLA định kỳ mỗi phút.
    onModuleInit() {
        this.slaTimer = setInterval(() => {
            void this.refreshSlaStatus().catch((error) => {
                this.logger.warn(
                    `Bo qua cap nhat SLA do loi tam thoi: ${error instanceof Error ? error.message : String(error)}`,
                );
            });
        }, 60_000);
    }

    // Dọn timer khi module bị tắt để tránh rò rỉ tài nguyên.
    onModuleDestroy() {
        if (this.slaTimer) {
            clearInterval(this.slaTimer);
            this.slaTimer = null;
        }
    }

    // Kiểm tra actor có phải nhân viên thật sự hay không.
    private isEmployeeRole(actor: AppointmentActor) {
        return Array.isArray(actor.roles) && actor.roles.includes('EMPLOYEE') && !actor.roles.includes('ADMIN');
    }

    // Tìm employeeId theo userId của tài khoản nhân viên.
    private async resolveEmployeeIdByUser(userId: number) {
        const employee = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
        if (!employee) {
            throw new BadRequestException('Tài khoản nhân viên không hợp lệ');
        }
        return employee.id;
    }

    // Tạo điều kiện lọc chung cho danh sách lịch hẹn của admin.
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
                    { house: { title: { contains: keyword } } },
                    { land: { title: { contains: keyword } } },
                ],
            });
        }

        if (andConditions.length === 0) return {};
        if (andConditions.length === 1) return andConditions[0];

        return { AND: andConditions };
    }

    // Chuẩn hóa chuỗi để so sánh tên vùng/khu vực.
    private normalizeText(value?: string | null) {
        return (value || '').trim().toLowerCase();
    }

    // Lấy đầu ngày theo múi giờ kinh doanh.
    private startOfDay(date: Date) {
        const business = this.toBusinessDate(date);
        business.setUTCHours(0, 0, 0, 0);
        return this.fromBusinessDate(business);
    }

    // Lấy cuối ngày theo múi giờ kinh doanh.
    private endOfDay(date: Date) {
        const business = this.toBusinessDate(date);
        business.setUTCHours(23, 59, 59, 999);
        return this.fromBusinessDate(business);
    }

    // Cộng phút vào một thời điểm.
    private addMinutes(date: Date, minutes: number) {
        return new Date(date.getTime() + minutes * 60_000);
    }

    // Kiểm tra hai khoảng thời gian có chồng lấn nhau hay không.
    private hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
        return startA < endB && startB < endA;
    }

    // Chuyển sang thời gian nghiệp vụ của hệ thống (GMT+7).
    private toBusinessDate(date: Date) {
        return new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
    }

    // Chuyển từ thời gian nghiệp vụ về UTC chuẩn để lưu/so sánh.
    private fromBusinessDate(date: Date) {
        return new Date(date.getTime() - BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
    }

    // Tạo Date có đúng giờ/phút trong cùng ngày nghiệp vụ.
    private toClockDate(base: Date, hour: number, minute: number) {
        const business = this.toBusinessDate(base);
        business.setUTCHours(hour, minute, 0, 0);
        return this.fromBusinessDate(business);
    }

    // Kiểm tra một thời điểm có khớp block 30 phút hay không.
    private isSlotAligned(date: Date) {
        const business = this.toBusinessDate(date);
        return (
            business.getUTCSeconds() === 0
            && business.getUTCMilliseconds() === 0
            && business.getUTCMinutes() % WORKING_HOURS.slotMinutes === 0
        );
    }

    // Kiểm tra lịch hẹn nằm hoàn toàn trong khung làm việc hợp lệ.
    private isInsideWorkingWindow(start: Date, end: Date) {
        const startBusiness = this.toBusinessDate(start);
        const endBusiness = this.toBusinessDate(end);

        const sameBusinessDate = startBusiness.toISOString().slice(0, 10) === endBusiness.toISOString().slice(0, 10);
        if (!sameBusinessDate) return false;

        const startMinutes = startBusiness.getUTCHours() * 60 + startBusiness.getUTCMinutes();
        const endMinutes = endBusiness.getUTCHours() * 60 + endBusiness.getUTCMinutes();

        const morningStart = WORKING_HOURS.morningStartHour * 60 + WORKING_HOURS.morningStartMinute;
        const morningEnd = WORKING_HOURS.morningEndHour * 60 + WORKING_HOURS.morningEndMinute;
        const afternoonStart = WORKING_HOURS.afternoonStartHour * 60 + WORKING_HOURS.afternoonStartMinute;
        const afternoonEnd = WORKING_HOURS.afternoonEndHour * 60 + WORKING_HOURS.afternoonEndMinute;

        const inMorning = startMinutes >= morningStart && endMinutes <= morningEnd;
        const inAfternoon = startMinutes >= afternoonStart && endMinutes <= afternoonEnd;
        return inMorning || inAfternoon;
    }

    // Chặn lịch đặt sai khung giờ hoặc sai độ dài slot.
    private assertWorkingSlot(start: Date, durationMinutes: number) {
        const end = this.addMinutes(start, durationMinutes);
        if (!this.isSlotAligned(start)) {
            throw new BadRequestException('Giờ hẹn phải theo block 30 phút');
        }

        if (durationMinutes % WORKING_HOURS.slotMinutes !== 0) {
            throw new BadRequestException('Thời lượng lịch hẹn phải chia hết cho 30 phút');
        }

        if (!this.isInsideWorkingWindow(start, end)) {
            throw new BadRequestException('Giờ hẹn phải nằm trong khung làm việc 08:00-12:00 hoặc 13:30-17:30');
        }
    }

    // Tạo baseline SLA cho lịch hẹn mới.
    private getSlaBaseline(now = new Date()) {
        return {
            slaAssignDeadlineAt: this.addMinutes(now, 5),
            slaFirstContactDeadlineAt: this.addMinutes(now, 24 * 60),
            slaStatus: SLA_STATUS.ON_TRACK,
        };
    }

    // Tính SLA hiện tại theo trạng thái gán nhân viên và liên hệ đầu tiên.
    private computeSlaStatus(input: {
        now: Date;
        employeeId?: number | null;
        assignedAt?: Date | null;
        firstContactAt?: Date | null;
        slaAssignDeadlineAt?: Date | null;
        slaFirstContactDeadlineAt?: Date | null;
    }) {
        const {
            now,
            employeeId,
            firstContactAt,
            slaAssignDeadlineAt,
            slaFirstContactDeadlineAt,
        } = input;

        if (!employeeId && slaAssignDeadlineAt) {
            if (now > slaAssignDeadlineAt) return SLA_STATUS.BREACHED;
            if (slaAssignDeadlineAt.getTime() - now.getTime() <= 120_000) return SLA_STATUS.AT_RISK;
            return SLA_STATUS.ON_TRACK;
        }

        if (employeeId && !firstContactAt && slaFirstContactDeadlineAt) {
            if (now > slaFirstContactDeadlineAt) return SLA_STATUS.BREACHED;
            if (slaFirstContactDeadlineAt.getTime() - now.getTime() <= 120_000) return SLA_STATUS.AT_RISK;
            return SLA_STATUS.ON_TRACK;
        }

        return SLA_STATUS.ON_TRACK;
    }

    // Tìm các lịch hẹn đang tồn tại của nhân viên để phát hiện xung đột.
    private async hasConflict(employeeId: number, appointmentDate: Date, durationMinutes: number, excludeId?: number) {
        const start = appointmentDate;
        const end = this.addMinutes(appointmentDate, durationMinutes);

        const candidates = await this.prisma.appointment.findMany({
            where: {
                employeeId,
                status: { in: [0, 1] },
                ...(excludeId ? { id: { not: excludeId } } : {}),
                appointmentDate: {
                    gte: this.addMinutes(start, -24 * 60),
                    lte: this.addMinutes(end, 24 * 60),
                },
            },
            select: {
                appointmentDate: true,
                durationMinutes: true,
            },
        });

        return candidates.some((item) => {
            const existingStart = new Date(item.appointmentDate);
            const existingEnd = this.addMinutes(existingStart, item.durationMinutes || 60);
            return this.hasOverlap(start, end, existingStart, existingEnd);
        });
    }

    // Đếm số lịch hẹn của một nhân viên trong một ngày.
    private async getDailyLoad(employeeId: number, date: Date) {
        return this.prisma.appointment.count({
            where: {
                employeeId,
                status: { in: [0, 1] },
                appointmentDate: {
                    gte: this.startOfDay(date),
                    lte: this.endOfDay(date),
                },
            },
        });
    }

    // Chấm điểm các nhân viên phù hợp để auto-assign một lịch hẹn.
    private async buildAutoAssignCandidates(appointmentId: number, appointmentDate: Date, durationMinutes: number, city?: string, ward?: string) {
        const targetCity = this.normalizeText(city);
        const targetWard = this.normalizeText(ward);

        const employees = await this.prisma.employee.findMany({
            where: {
                status: 1,
                isActive: true,
            },
            select: {
                id: true,
                city: true,
                ward: true,
                maxAppointmentsPerDay: true,
                lastAssignedAt: true,
            },
        });

        const fallbackEmployees = employees.length > 0 ? employees : await this.prisma.employee.findMany({
            where: { status: 1, isActive: true },
            select: {
                id: true,
                city: true,
                ward: true,
                maxAppointmentsPerDay: true,
                lastAssignedAt: true,
            },
        });

        const candidates: AutoAssignCandidate[] = [];

        for (const employee of fallbackEmployees) {
            const [load, hasConflict] = await Promise.all([
                this.getDailyLoad(employee.id, appointmentDate),
                this.hasConflict(employee.id, appointmentDate, durationMinutes, appointmentId),
            ]);

            if (hasConflict) continue;
            if (load >= employee.maxAppointmentsPerDay) continue;

            const employeeCity = this.normalizeText(employee.city);
            const employeeWard = this.normalizeText(employee.ward);

            const locationScore = targetWard && employeeWard === targetWard
                ? 1
                : targetCity && employeeCity === targetCity
                    ? 0.85
                    : 0.45;
            const workloadScore = Math.max(0, 1 - load / Math.max(employee.maxAppointmentsPerDay, 1));
            const fairnessHours = employee.lastAssignedAt
                ? Math.min(72, (Date.now() - new Date(employee.lastAssignedAt).getTime()) / 3_600_000)
                : 72;
            const fairnessScore = fairnessHours / 72;

            const score = 0.40 * locationScore + 0.35 * workloadScore + 0.25 * fairnessScore;

            const reasonParts = [
                targetWard && employeeWard === targetWard ? 'cùng phường/xã' : (targetCity && employeeCity === targetCity ? 'cùng tỉnh/thành' : 'khu vực lân cận'),
                'lịch trống',
                load === 0 ? 'đang rảnh' : 'tải phù hợp',
            ];

            candidates.push({
                employeeId: employee.id,
                score,
                reason: reasonParts.join(', '),
            });
        }

        return candidates.sort((a, b) => b.score - a.score);
    }

    // Tìm các khung giờ thay thế nếu slot hiện tại bị xung đột.
    private async suggestAlternativeSlots(appointmentId: number, baseDate: Date, durationMinutes: number, city?: string, district?: string) {
        const suggestions: Array<{ at: string; availableEmployees: number }> = [];

        const maxDays = 5;
        let dayOffset = 0;

        while (suggestions.length < 6 && dayOffset <= maxDays) {
            const base = this.addMinutes(baseDate, dayOffset * 24 * 60);
            const windows: Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }> = [
                {
                    startHour: WORKING_HOURS.morningStartHour,
                    startMinute: WORKING_HOURS.morningStartMinute,
                    endHour: WORKING_HOURS.morningEndHour,
                    endMinute: WORKING_HOURS.morningEndMinute,
                },
                {
                    startHour: WORKING_HOURS.afternoonStartHour,
                    startMinute: WORKING_HOURS.afternoonStartMinute,
                    endHour: WORKING_HOURS.afternoonEndHour,
                    endMinute: WORKING_HOURS.afternoonEndMinute,
                },
            ];

            for (const window of windows) {
                let slot = this.toClockDate(base, window.startHour, window.startMinute);
                const windowEnd = this.toClockDate(base, window.endHour, window.endMinute);

                while (this.addMinutes(slot, durationMinutes) <= windowEnd && suggestions.length < 6) {
                    if (slot <= baseDate) {
                        slot = this.addMinutes(slot, WORKING_HOURS.slotMinutes);
                        continue;
                    }

                    const candidates = await this.buildAutoAssignCandidates(appointmentId, slot, durationMinutes, city, district);
                    if (candidates.length > 0) {
                        suggestions.push({
                            at: slot.toISOString(),
                            availableEmployees: candidates.length,
                        });
                    }

                    slot = this.addMinutes(slot, WORKING_HOURS.slotMinutes);
                }
            }

            dayOffset += 1;
        }

        if (suggestions.length > 0) {
            return suggestions;
        }

        for (const offset of [60, 120, 180]) {
            const slot = this.addMinutes(baseDate, offset);
            const candidates = await this.buildAutoAssignCandidates(appointmentId, slot, durationMinutes, city, district);
            suggestions.push({
                at: slot.toISOString(),
                availableEmployees: candidates.length,
            });
        }

        return suggestions;
    }

    // Quét lại toàn bộ lịch hẹn để cập nhật SLA đang chạy.
    private async refreshSlaStatus() {
        const now = new Date();
        const appointments = await this.prisma.appointment.findMany({
            where: {
                status: { in: [0, 1] },
            },
            select: {
                id: true,
                employeeId: true,
                assignedAt: true,
                firstContactAt: true,
                slaAssignDeadlineAt: true,
                slaFirstContactDeadlineAt: true,
                slaStatus: true,
            },
        });

        await Promise.all(appointments.map(async (item) => {
            const nextStatus = this.computeSlaStatus({
                now,
                employeeId: item.employeeId,
                assignedAt: item.assignedAt,
                firstContactAt: item.firstContactAt,
                slaAssignDeadlineAt: item.slaAssignDeadlineAt,
                slaFirstContactDeadlineAt: item.slaFirstContactDeadlineAt,
            });

            if (nextStatus !== item.slaStatus) {
                await this.prisma.appointment.update({
                    where: { id: item.id },
                    data: { slaStatus: nextStatus },
                });
            }
        }));
    }

    // Lấy danh sách lịch hẹn cho admin kèm phân trang, tìm kiếm và thống kê trạng thái.
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

    // Lấy chi tiết một lịch hẹn theo id.
    async findById(id: number) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: appointmentInclude,
        });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        return appointment;
    }

    // Khách hàng tự tạo lịch hẹn mới.
    async create(dto: CreateAppointmentDto, userId: number) {
        const customer = await this.prisma.customer.findUnique({ where: { userId } });
        if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

        if (!dto.houseId && !dto.landId) {
            throw new BadRequestException('Vui lòng chọn nhà hoặc đất');
        }

        const now = new Date();
        const durationMinutes = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
        const appointmentDate = new Date(dto.appointmentDate);
        this.assertWorkingSlot(appointmentDate, durationMinutes);
        const slaBaseline = this.getSlaBaseline(now);

        const appointment = await this.prisma.appointment.create({
            data: {
                houseId: dto.houseId || null,
                landId: dto.landId || null,
                customerId: customer.id,
                employeeId: null,
                appointmentDate,
                durationMinutes,
                ...slaBaseline,
                status: 0,
            },
        });

        this.autoAssignProducer.publishAutoAssign(appointment.id);

        return { message: 'Đặt lịch hẹn thành công, đang chờ duyệt', data: appointment };
    }

    // Admin tạo lịch hẹn, có thể dùng khách hiện có hoặc tạo khách mới.
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

        const now = new Date();
        const durationMinutes = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
        const appointmentDate = new Date(dto.appointmentDate);
        this.assertWorkingSlot(appointmentDate, durationMinutes);
        const slaBaseline = this.getSlaBaseline(now);

        const appointment = await this.prisma.appointment.create({
            data: {
                houseId: dto.houseId || null,
                landId: dto.landId || null,
                customerId: resolvedCustomerId,
                employeeId: dto.employeeId || null,
                appointmentDate,
                durationMinutes,
                assignedAt: dto.employeeId ? now : null,
                ...slaBaseline,
                slaStatus: dto.employeeId ? SLA_STATUS.ON_TRACK : slaBaseline.slaStatus,
                status: 0,
            },
            include: appointmentInclude,
        });

        if (!dto.employeeId) {
            this.autoAssignProducer.publishAutoAssign(appointment.id);
        }

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

    // Admin cập nhật lịch hẹn: ngày giờ, nhân viên, trạng thái.
    async update(id: number, dto: UpdateAppointmentDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        const nextAppointmentDate = dto.appointmentDate ? new Date(dto.appointmentDate) : appointment.appointmentDate;
        const nextEmployeeId = dto.employeeId !== undefined ? (dto.employeeId || null) : appointment.employeeId;
        const nextStatus = dto.status !== undefined ? dto.status : appointment.status;
        const nextDuration = dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : appointment.durationMinutes;

        if (nextStatus === 1 && !nextEmployeeId) {
            throw new BadRequestException('Lịch hẹn đã duyệt phải có nhân viên phụ trách');
        }

        if (nextStatus === 1 && nextEmployeeId) {
            this.assertWorkingSlot(nextAppointmentDate, nextDuration);
            const conflict = await this.hasConflict(nextEmployeeId, nextAppointmentDate, nextDuration, id);
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
                ...(dto.durationMinutes !== undefined && { durationMinutes: nextDuration }),
                ...(dto.employeeId !== undefined && {
                    assignedAt: nextEmployeeId ? new Date() : null,
                    slaStatus: this.computeSlaStatus({
                        now: new Date(),
                        employeeId: nextEmployeeId,
                        assignedAt: nextEmployeeId ? new Date() : null,
                        firstContactAt: appointment.firstContactAt,
                        slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                        slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                    }),
                }),
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

    // Xóa một lịch hẹn theo id.
    async delete(id: number) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
        await this.prisma.appointment.delete({ where: { id } });
        return { message: 'Xóa lịch hẹn thành công' };
    }

    // Gán hoặc đổi nhân viên phụ trách cho lịch hẹn.
    async assignEmployee(id: number, dto: AssignEmployeeDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

        this.assertWorkingSlot(appointment.appointmentDate, appointment.durationMinutes || 60);
        const conflict = await this.hasConflict(
            dto.employeeId,
            appointment.appointmentDate,
            appointment.durationMinutes || 60,
            id,
        );
        if (conflict) {
            throw new BadRequestException('Nhân viên đã có lịch hẹn trong khoảng thời gian này');
        }

        const now = new Date();

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                employeeId: dto.employeeId,
                assignedAt: now,
                slaStatus: this.computeSlaStatus({
                    now,
                    employeeId: dto.employeeId,
                    assignedAt: now,
                    firstContactAt: appointment.firstContactAt,
                    slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                    slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                }),
                autoAssignReason: 'Gán thủ công bởi quản trị',
            },
            include: appointmentInclude,
        });

        await this.prisma.employee.update({
            where: { id: dto.employeeId },
            data: { lastAssignedAt: now },
        });

        return { message: 'Phân công nhân viên thành công', data: updated };
    }

    // Duyệt lịch hẹn và gán nhân viên chính thức.
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

        this.assertWorkingSlot(appointment.appointmentDate, appointment.durationMinutes || 60);
        const conflict = await this.hasConflict(
            dto.employeeId,
            appointment.appointmentDate,
            appointment.durationMinutes || 60,
            id,
        );
        if (conflict) throw new BadRequestException('Nhân viên đã có lịch hẹn vào thời điểm này');

        const now = new Date();

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                employeeId: dto.employeeId,
                status: 1,
                assignedAt: now,
                slaStatus: this.computeSlaStatus({
                    now,
                    employeeId: dto.employeeId,
                    assignedAt: now,
                    firstContactAt: appointment.firstContactAt,
                    slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                    slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                }),
                autoAssignReason: 'Duyệt thủ công bởi quản trị',
            },
            include: appointmentInclude,
        });

        await this.prisma.employee.update({
            where: { id: dto.employeeId },
            data: { lastAssignedAt: now },
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

    // Từ chối hoặc hủy lịch hẹn, có thể kèm lý do.
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

    // Tự động chọn nhân viên phù hợp nhất cho lịch hẹn.
    async autoAssign(id: number, force = false) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                house: { select: { city: true, ward: true, district: true } },
                land: { select: { city: true, ward: true, district: true } },
            },
        });

        if (!appointment) {
            throw new NotFoundException('Lịch hẹn không tồn tại');
        }

        if (appointment.status === 2) {
            throw new BadRequestException('Lịch hẹn đã bị từ chối, không thể auto-assign');
        }

        if (appointment.employeeId && !force) {
            return { message: 'Lịch hẹn đã có nhân viên phụ trách', assigned: false };
        }

        const city = appointment.house?.city || appointment.land?.city || undefined;
        const ward = appointment.house?.ward || appointment.land?.ward || appointment.house?.district || appointment.land?.district || undefined;
        const durationMinutes = appointment.durationMinutes || 60;
        this.assertWorkingSlot(appointment.appointmentDate, durationMinutes);

        const candidates = await this.buildAutoAssignCandidates(
            appointment.id,
            appointment.appointmentDate,
            durationMinutes,
            city,
            ward,
        );

        if (candidates.length === 0) {
            const suggestions = await this.suggestAlternativeSlots(
                appointment.id,
                appointment.appointmentDate,
                durationMinutes,
                city,
                ward,
            );

            return {
                message: 'Không tìm được nhân viên phù hợp',
                assigned: false,
                suggestions,
            };
        }

        const best = candidates[0];
        const now = new Date();

        if (!force) {
            const updateResult = await this.prisma.appointment.updateMany({
                where: { id, employeeId: null },
                data: {
                    employeeId: best.employeeId,
                    assignedAt: now,
                    autoAssignReason: best.reason,
                    slaStatus: this.computeSlaStatus({
                        now,
                        employeeId: best.employeeId,
                        assignedAt: now,
                        firstContactAt: appointment.firstContactAt,
                        slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                        slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                    }),
                },
            });

            if (updateResult.count === 0) {
                return { message: 'Lịch hẹn đã được gán bởi tiến trình khác', assigned: false };
            }
        } else {
            await this.prisma.appointment.update({
                where: { id },
                data: {
                    employeeId: best.employeeId,
                    assignedAt: now,
                    autoAssignReason: best.reason,
                    slaStatus: this.computeSlaStatus({
                        now,
                        employeeId: best.employeeId,
                        assignedAt: now,
                        firstContactAt: appointment.firstContactAt,
                        slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                        slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                    }),
                },
            });
        }

        await this.prisma.employee.update({
            where: { id: best.employeeId },
            data: { lastAssignedAt: now },
        });

        const assignedAppointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: appointmentInclude,
        });

        return {
            message: `Đã auto-assign cho nhân viên #${best.employeeId}`,
            assigned: true,
            reason: best.reason,
            data: assignedAppointment,
        };
    }

    // Gợi ý các slot thay thế nếu lịch hiện tại chưa thể gán.
    async suggestSlots(id: number) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                house: { select: { city: true, ward: true, district: true } },
                land: { select: { city: true, ward: true, district: true } },
            },
        });

        if (!appointment) {
            throw new NotFoundException('Lịch hẹn không tồn tại');
        }

        const city = appointment.house?.city || appointment.land?.city || undefined;
        const ward = appointment.house?.ward || appointment.land?.ward || appointment.house?.district || appointment.land?.district || undefined;

        return this.suggestAlternativeSlots(
            appointment.id,
            appointment.appointmentDate,
            appointment.durationMinutes || 60,
            city,
            ward,
        );
    }

    // Tạo dữ liệu lịch cho FullCalendar trên màn hình quản trị.
    async getCalendarEvents(query: AppointmentCalendarQueryDto) {
        const start = new Date(query.start);
        const end = new Date(query.end);
        const employeeId = query.employeeId !== undefined ? Number(query.employeeId) : undefined;

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            throw new BadRequestException('Khoảng thời gian không hợp lệ');
        }

        if (employeeId !== undefined && Number.isNaN(employeeId)) {
            throw new BadRequestException('Nhân viên lọc không hợp lệ');
        }

        const appointments = await this.prisma.appointment.findMany({
            where: {
                status: 1,
                employeeId: { not: null, ...(employeeId ? { equals: employeeId } : {}) },
                appointmentDate: { gte: start, lt: end },
            },
            include: {
                customer: { include: { user: { select: { fullName: true, phone: true } } } },
                employee: { include: { user: { select: { fullName: true } } } },
                house: { select: { title: true, city: true, district: true } },
                land: { select: { title: true, city: true, district: true } },
            },
            orderBy: { appointmentDate: 'asc' },
        });

        return appointments.map((item) => {
            const title = item.house?.title || item.land?.title || 'Lịch hẹn';
            const customerName = item.customer?.user?.fullName || 'Khách hàng';
            const employeeName = item.employee?.user?.fullName || `NV #${item.employeeId}`;
            const durationMinutes = item.durationMinutes || 60;

            return {
                id: item.id,
                title: `${title} - ${customerName}`,
                start: item.appointmentDate.toISOString(),
                end: this.addMinutes(item.appointmentDate, durationMinutes).toISOString(),
                allDay: false,
                extendedProps: {
                    employeeId: item.employeeId,
                    employeeName,
                    customerName,
                    durationMinutes,
                    location: `${item.house?.district || item.land?.district || ''}, ${item.house?.city || item.land?.city || ''}`.replace(/^,\s*|,\s*$/g, ''),
                },
            };
        });
    }

    // Di chuyển một lịch hẹn trên calendar sang giờ hoặc nhân viên khác.
    async moveCalendarAppointment(id: number, dto: MoveCalendarAppointmentDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) {
            throw new NotFoundException('Lịch hẹn không tồn tại');
        }

        if (appointment.status !== 1) {
            throw new BadRequestException('Chỉ điều phối lịch hẹn đã duyệt');
        }

        const nextDate = new Date(dto.appointmentDate);
        if (Number.isNaN(nextDate.getTime())) {
            throw new BadRequestException('Thời gian lịch hẹn không hợp lệ');
        }

        if (nextDate < new Date()) {
            throw new BadRequestException('Không thể điều phối lịch hẹn quá khứ');
        }

        const nextEmployeeId = dto.employeeId || appointment.employeeId;
        if (!nextEmployeeId) {
            throw new BadRequestException('Lịch hẹn phải có nhân viên phụ trách');
        }

        const durationMinutes = appointment.durationMinutes || 60;
        this.assertWorkingSlot(nextDate, durationMinutes);

        const conflict = await this.hasConflict(nextEmployeeId, nextDate, durationMinutes, id);
        if (conflict) {
            const entity = await this.prisma.appointment.findUnique({
                where: { id },
                include: {
                    house: { select: { city: true, ward: true, district: true } },
                    land: { select: { city: true, ward: true, district: true } },
                },
            });

            const suggestions = await this.suggestAlternativeSlots(
                id,
                nextDate,
                durationMinutes,
                entity?.house?.city || entity?.land?.city || undefined,
                entity?.house?.ward || entity?.land?.ward || entity?.house?.district || entity?.land?.district || undefined,
            );

            throw new BadRequestException({
                message: 'Xung đột lịch hẹn với nhân viên đã chọn',
                suggestions,
            });
        }

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                appointmentDate: nextDate,
                employeeId: nextEmployeeId,
                assignedAt: new Date(),
                autoAssignReason: dto.employeeId && dto.employeeId !== appointment.employeeId
                    ? 'Điều phối lại trên lịch (đổi nhân viên)'
                    : 'Điều phối lại trên lịch (đổi giờ)',
            },
            include: appointmentInclude,
        });

        await this.prisma.employee.update({
            where: { id: nextEmployeeId },
            data: { lastAssignedAt: new Date() },
        });

        return { message: 'Điều phối lịch thành công', data: updated };
    }

    // Đánh dấu thời điểm liên hệ lần đầu với khách hàng.
    async markFirstContact(id: number, dto: MarkFirstContactDto) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appointment) {
            throw new NotFoundException('Lịch hẹn không tồn tại');
        }

        const firstContactAt = dto.firstContactAt ? new Date(dto.firstContactAt) : new Date();
        const now = new Date();

        const updated = await this.prisma.appointment.update({
            where: { id },
            data: {
                firstContactAt,
                slaStatus: this.computeSlaStatus({
                    now,
                    employeeId: appointment.employeeId,
                    assignedAt: appointment.assignedAt,
                    firstContactAt,
                    slaAssignDeadlineAt: appointment.slaAssignDeadlineAt,
                    slaFirstContactDeadlineAt: appointment.slaFirstContactDeadlineAt,
                }),
            },
            include: appointmentInclude,
        });

        return { message: 'Đã cập nhật lần liên hệ đầu tiên', data: updated };
    }

    // Lấy lịch hẹn của một nhân viên, có kiểm tra quyền nếu actor là nhân viên.
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

    // Lấy tất cả lịch hẹn đang được phân công cho chính nhân viên đang đăng nhập.
    async findMyAssignedAppointments(actor: AppointmentActor) {
        const employeeId = await this.resolveEmployeeIdByUser(actor.id);
        return this.findByEmployee(employeeId, { ...actor, roles: ['EMPLOYEE'] });
    }

    // Cập nhật trạng thái thực tế sau khi nhân viên xử lý lịch hẹn.
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