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
import { NotificationService } from '../notification/notification.service';
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
  employee: {
    include: { user: { select: { id: true, fullName: true, phone: true } } },
  },
  customer: {
    include: {
      user: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  },
  house: {
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      images: {
        select: { id: true, url: true },
        orderBy: { position: 'asc' as const },
        take: 1,
      },
    },
  },
  land: {
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      images: {
        select: { id: true, url: true },
        orderBy: { position: 'asc' as const },
        take: 1,
      },
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

// [ADD] Giới hạn tối đa 10 ngày kể từ hiện tại cho phép đặt lịch hẹn
const MAX_BOOKING_DAYS_AHEAD = 10;

type AutoAssignCandidate = {
  employeeId: number;
  score: number;
  reason: string;
};

@Injectable()
export class AppointmentService implements OnModuleInit, OnModuleDestroy {
  private slaTimer: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private mailProducer: MailProducerService,
    private autoAssignProducer: AppointmentAutoAssignProducerService,
    private notificationService: NotificationService,
  ) { }

  onModuleInit() {
    this.slaTimer = setInterval(() => {
      void this.refreshSlaStatus().catch((error) => {
        this.logger.warn(
          `Bo qua cap nhat SLA do loi tam thoi: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.slaTimer) {
      clearInterval(this.slaTimer);
      this.slaTimer = null;
    }
  }

  private isEmployeeRole(actor: AppointmentActor) {
    return (
      Array.isArray(actor.roles) &&
      actor.roles.includes('EMPLOYEE') &&
      !actor.roles.includes('ADMIN')
    );
  }

  private async resolveEmployeeIdByUser(userId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
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
          { house: { title: { contains: keyword } } },
          { land: { title: { contains: keyword } } },
        ],
      });
    }

    if (andConditions.length === 0) return {};
    if (andConditions.length === 1) return andConditions[0];

    return { AND: andConditions };
  }

  private normalizeText(value?: string | null) {
    return (value || '').trim().toLowerCase();
  }

  private startOfDay(date: Date) {
    const business = this.toBusinessDate(date);
    business.setUTCHours(0, 0, 0, 0);
    return this.fromBusinessDate(business);
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && startB < endA;
  }

  private toBusinessDate(date: Date) {
    return new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
  }

  private fromBusinessDate(date: Date) {
    return new Date(date.getTime() - BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
  }

  private toClockDate(base: Date, hour: number, minute: number) {
    const business = this.toBusinessDate(base);
    business.setUTCHours(hour, minute, 0, 0);
    return this.fromBusinessDate(business);
  }

  private isSlotAligned(date: Date) {
    const business = this.toBusinessDate(date);
    return (
      business.getUTCSeconds() === 0 &&
      business.getUTCMilliseconds() === 0 &&
      business.getUTCMinutes() % WORKING_HOURS.slotMinutes === 0
    );
  }

  private isInsideWorkingWindow(start: Date, end: Date) {
    const startBusiness = this.toBusinessDate(start);
    const endBusiness = this.toBusinessDate(end);

    const sameBusinessDate =
      startBusiness.toISOString().slice(0, 10) ===
      endBusiness.toISOString().slice(0, 10);
    if (!sameBusinessDate) return false;

    const startMinutes =
      startBusiness.getUTCHours() * 60 + startBusiness.getUTCMinutes();
    const endMinutes =
      endBusiness.getUTCHours() * 60 + endBusiness.getUTCMinutes();

    const morningStart =
      WORKING_HOURS.morningStartHour * 60 + WORKING_HOURS.morningStartMinute;
    const morningEnd =
      WORKING_HOURS.morningEndHour * 60 + WORKING_HOURS.morningEndMinute;
    const afternoonStart =
      WORKING_HOURS.afternoonStartHour * 60 +
      WORKING_HOURS.afternoonStartMinute;
    const afternoonEnd =
      WORKING_HOURS.afternoonEndHour * 60 + WORKING_HOURS.afternoonEndMinute;

    const inMorning = startMinutes >= morningStart && endMinutes <= morningEnd;
    const inAfternoon =
      startMinutes >= afternoonStart && endMinutes <= afternoonEnd;
    return inMorning || inAfternoon;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

 private assertWorkingSlot(start: Date, durationMinutes: number) {
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    if (!this.isSlotAligned(start)) {
      throw new BadRequestException('Giờ hẹn phải theo block 30 phút');
    }

    if (durationMinutes % 30 !== 0) {
      throw new BadRequestException('Thời lượng lịch hẹn phải chia hết cho 30 phút');
    }

    if (!this.isInsideWorkingWindow(start, end)) {
      throw new BadRequestException('Giờ hẹn phải nằm trong khung làm việc 08:00-12:00 hoặc 13:30-17:30');
    }
  }

  /**
   * [ADD] Validate: không cho phép đặt lịch hẹn quá MAX_BOOKING_DAYS_AHEAD (10 ngày) kể từ hôm nay.
   * Tính theo ngày đầy đủ: hết ngày thứ 10 (23:59:59) là deadline.
   */
  private assertBookingDateWithinLimit(appointmentDate: Date, now = new Date()) {
    const maxDate = this.endOfDay(this.addDays(now, MAX_BOOKING_DAYS_AHEAD));
    if (appointmentDate.getTime() > maxDate.getTime()) {
      throw new BadRequestException(
        `Chỉ được đặt lịch hẹn trong vòng ${MAX_BOOKING_DAYS_AHEAD} ngày kể từ hôm nay`,
      );
    }
  }

  private getSlaBaseline(now = new Date()) {
    return {
      slaAssignDeadlineAt: this.addMinutes(now, 30),
      slaFirstContactDeadlineAt: this.addMinutes(now, 24 * 60),
      slaStatus: SLA_STATUS.ON_TRACK,
    };
  }

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
      if (slaAssignDeadlineAt.getTime() - now.getTime() <= 600_000)
        return SLA_STATUS.AT_RISK;
      return SLA_STATUS.ON_TRACK;
    }

    if (employeeId && !firstContactAt && slaFirstContactDeadlineAt) {
      if (now > slaFirstContactDeadlineAt) return SLA_STATUS.BREACHED;
      if (slaFirstContactDeadlineAt.getTime() - now.getTime() <= 600_000)
        return SLA_STATUS.AT_RISK;
      return SLA_STATUS.ON_TRACK;
    }

    return SLA_STATUS.ON_TRACK;
  }

  private async hasConflict(
    employeeId: number,
    appointmentDate: Date,
    durationMinutes: number,
    excludeId?: number,
  ) {
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
      const existingEnd = this.addMinutes(
        existingStart,
        item.durationMinutes || 60,
      );
      return this.hasOverlap(start, end, existingStart, existingEnd);
    });
  }

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

  private async buildAutoAssignCandidates(
    appointmentId: number,
    appointmentDate: Date,
    durationMinutes: number,
    city?: string,
    ward?: string,
    preferredEmployeeId?: number,
  ) {
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

    const candidates: AutoAssignCandidate[] = [];

    for (const employee of employees) {
      const [load, hasConflict] = await Promise.all([
        this.getDailyLoad(employee.id, appointmentDate),
        this.hasConflict(
          employee.id,
          appointmentDate,
          durationMinutes,
          appointmentId,
        ),
      ]);

      if (hasConflict) continue;
      if (load >= employee.maxAppointmentsPerDay) continue;

      const employeeCity = this.normalizeText(employee.city);
      const employeeWard = this.normalizeText(employee.ward);
      const isPreferred =
        typeof preferredEmployeeId === 'number' &&
        employee.id === preferredEmployeeId;

      const locationScore =
        targetWard && employeeWard === targetWard
          ? 1
          : targetCity && employeeCity === targetCity
            ? 0.85
            : 0.45;
      const workloadScore = Math.max(
        0,
        1 - load / Math.max(employee.maxAppointmentsPerDay, 1),
      );
      const fairnessHours = employee.lastAssignedAt
        ? Math.min(
          72,
          (Date.now() - new Date(employee.lastAssignedAt).getTime()) /
          3_600_000,
        )
        : 72;
      const fairnessScore = fairnessHours / 72;

      const score = isPreferred
        ? 2
        : 0.4 * locationScore + 0.35 * workloadScore + 0.25 * fairnessScore;

      const reasonParts = [
        ...(isPreferred ? ['nhân viên quản lý bất động sản'] : []),
        targetWard && employeeWard === targetWard
          ? 'cùng phường/xã'
          : targetCity && employeeCity === targetCity
            ? 'cùng tỉnh/thành'
            : 'khu vực lân cận',
        'lịch trống',
        load === 0 ? 'đang rảnh' : 'tải phù hợp',
      ];

      candidates.push({
        employeeId: employee.id,
        score,
        reason: reasonParts.join(', '),
      });
    }

    if (typeof preferredEmployeeId === 'number') {
      const preferred = candidates.find(
        (item) => item.employeeId === preferredEmployeeId,
      );
      if (preferred) {
        return [preferred];
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private async suggestAlternativeSlots(
    appointmentId: number,
    baseDate: Date,
    durationMinutes: number,
    city?: string,
    district?: string,
    preferredEmployeeId?: number,
  ) {
    const suggestions: Array<{ at: string; availableEmployees: number }> = [];

    const maxDays = 5;
    let dayOffset = 0;

    while (suggestions.length < 6 && dayOffset <= maxDays) {
      const base = this.addMinutes(baseDate, dayOffset * 24 * 60);
      const windows: Array<{
        startHour: number;
        startMinute: number;
        endHour: number;
        endMinute: number;
      }> = [
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
        const windowEnd = this.toClockDate(
          base,
          window.endHour,
          window.endMinute,
        );

        while (
          this.addMinutes(slot, durationMinutes) <= windowEnd &&
          suggestions.length < 6
        ) {
          if (slot <= baseDate) {
            slot = this.addMinutes(slot, WORKING_HOURS.slotMinutes);
            continue;
          }

          const candidates = await this.buildAutoAssignCandidates(
            appointmentId,
            slot,
            durationMinutes,
            city,
            district,
            preferredEmployeeId,
          );
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
      const candidates = await this.buildAutoAssignCandidates(
        appointmentId,
        slot,
        durationMinutes,
        city,
        district,
        preferredEmployeeId,
      );
      suggestions.push({
        at: slot.toISOString(),
        availableEmployees: candidates.length,
      });
    }

    return suggestions;
  }

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

    await Promise.all(
      appointments.map(async (item) => {
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
      }),
    );
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

  // Khách hàng tự tạo lịch hẹn mới.
  async create(dto: CreateAppointmentDto, userId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');

    if (!!dto.houseId === !!dto.landId) {
      throw new BadRequestException(
        'Vui lòng chọn đúng một bất động sản (nhà hoặc đất)',
      );
    }

    const now = new Date();
    const durationMinutes =
      dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
    const appointmentDate = new Date(dto.appointmentDate);

    // [ADD] Validate: không được đặt lịch quá 10 ngày kể từ hôm nay
    this.assertBookingDateWithinLimit(appointmentDate, now);
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

    return {
      message: 'Đặt lịch hẹn thành công, đang chờ duyệt',
      data: appointment,
    };
  }

  // Admin tạo lịch hẹn.
  async adminCreate(dto: AdminCreateAppointmentDto) {
    if (!!dto.houseId === !!dto.landId) {
      throw new BadRequestException(
        'Vui lòng chọn đúng một bất động sản (nhà hoặc đất)',
      );
    }

    let resolvedCustomerId: number;

    if (dto.customerId) {
      const existing = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!existing) throw new BadRequestException('Khách hàng không tồn tại');
      resolvedCustomerId = dto.customerId;
    } else if (dto.newCustomerPhone) {
      const existingUser = await this.prisma.user.findUnique({
        where: { phone: dto.newCustomerPhone },
      });

      if (existingUser) {
        const existingCustomer = await this.prisma.customer.findUnique({
          where: { userId: existingUser.id },
        });
        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          const count = await this.prisma.customer.count();
          const newCustomer = await this.prisma.customer.create({
            data: {
              code: `CUS${String(count + 1).padStart(3, '0')}`,
              userId: existingUser.id,
            },
          });
          const customerRole = await this.prisma.role.findUnique({
            where: { code: 'CUSTOMER' },
          });
          if (customerRole) {
            await this.prisma.userRole.upsert({
              where: {
                userId_roleId: {
                  userId: existingUser.id,
                  roleId: customerRole.id,
                },
              },
              update: {},
              create: { userId: existingUser.id, roleId: customerRole.id },
            });
          }
          resolvedCustomerId = newCustomer.id;
        }
      } else {
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
        const customerRole = await this.prisma.role.findUnique({
          where: { code: 'CUSTOMER' },
        });
        if (customerRole) {
          await this.prisma.userRole.create({
            data: { userId: newUser.id, roleId: customerRole.id },
          });
        }
        const newCustomer = await this.prisma.customer.create({
          data: { code, userId: newUser.id },
        });
        resolvedCustomerId = newCustomer.id;
      }
    } else {
      throw new BadRequestException(
        'Vui lòng chọn khách hàng có sẵn hoặc nhập thông tin khách mới',
      );
    }

    const now = new Date();
    const durationMinutes =
      dto.durationMinutes && dto.durationMinutes > 0 ? dto.durationMinutes : 60;
    const appointmentDate = new Date(dto.appointmentDate);

    // [ADD] Admin cũng bị chặn nếu đặt lịch quá 10 ngày
    this.assertBookingDateWithinLimit(appointmentDate, now);
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

    const customerWithUser = await this.prisma.customer.findUnique({
      where: { id: resolvedCustomerId },
      include: { user: { select: { fullName: true, email: true } } },
    });
    const propertyTitle =
      appointment.house?.title || appointment.land?.title || '';
    if (customerWithUser?.user?.email) {
      const html = this.mailService.getConfirmationEmailHtml(
        customerWithUser.user.fullName || 'Quý khách',
        formatDateTime(new Date(dto.appointmentDate)),
        propertyTitle,
      );
      this.mailProducer.sendMail(
        customerWithUser.user.email,
        'Lịch hẹn của bạn đã được tạo - BĐS',
        html,
      );
    }

    return { message: 'Tạo lịch hẹn thành công', data: appointment };
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

    const nextAppointmentDate = dto.appointmentDate
      ? new Date(dto.appointmentDate)
      : appointment.appointmentDate;
    const nextEmployeeId =
      dto.employeeId !== undefined
        ? dto.employeeId || null
        : appointment.employeeId;
    const nextStatus =
      dto.status !== undefined ? dto.status : appointment.status;
    const nextDuration =
      dto.durationMinutes && dto.durationMinutes > 0
        ? dto.durationMinutes
        : appointment.durationMinutes;

    if (nextStatus === 1 && !nextEmployeeId) {
      throw new BadRequestException(
        'Lịch hẹn đã duyệt phải có nhân viên phụ trách',
      );
    }

    if (nextStatus === 1 && nextEmployeeId) {
      // [ADD] Validate 10 ngày khi admin update ngày hẹn
      if (dto.appointmentDate) {
        this.assertBookingDateWithinLimit(nextAppointmentDate);
      }
      this.assertWorkingSlot(nextAppointmentDate, nextDuration);
      const conflict = await this.hasConflict(
        nextEmployeeId,
        nextAppointmentDate,
        nextDuration,
        id,
      );
      if (conflict) {
        throw new BadRequestException(
          'Nhân viên đã có lịch hẹn vào thời điểm này',
        );
      }
    }

    const appointmentFull = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: {
          include: { user: { select: { fullName: true, email: true } } },
        },
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
        ...(dto.durationMinutes !== undefined && {
          durationMinutes: nextDuration,
        }),
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

    if (dto.status === 2 && appointmentFull?.customer?.user?.email) {
      const propertyTitle =
        appointmentFull.house?.title || appointmentFull.land?.title || '';
      const html = this.mailService.getCancellationEmailHtml(
        appointmentFull.customer.user.fullName || 'Quý khách',
        formatDateTime(appointmentFull.appointmentDate),
        propertyTitle,
      );
      this.mailProducer.sendMail(
        appointmentFull.customer.user.email,
        'Lịch hẹn của bạn đã bị từ chối - BĐS',
        html,
      );
    }

    // Gửi thông báo trong ứng dụng khi trạng thái thay đổi
    if (dto.status === 1 || dto.status === 2) {
      const updateCustomerUserId = appointmentFull?.customer?.userId as number | undefined;
      if (updateCustomerUserId) {
        const propertyTitle = appointmentFull?.house?.title || appointmentFull?.land?.title || '';
        if (dto.status === 1) {
          void this.notificationService
            .notifyAppointmentApproved(updateCustomerUserId, id, propertyTitle, appointmentFull!.appointmentDate)
            .catch(() => null);
        } else {
          void this.notificationService
            .notifyAppointmentRejected(updateCustomerUserId, id, propertyTitle)
            .catch(() => null);
        }
      }
    }

    return { message: 'Cập nhật lịch hẹn thành công', data: updated };

  }

  async delete(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
    await this.prisma.appointment.delete({ where: { id } });
    return { message: 'Xóa lịch hẹn thành công' };
  }

  async assignEmployee(id: number, dto: AssignEmployeeDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');

    this.assertWorkingSlot(
      appointment.appointmentDate,
      appointment.durationMinutes || 60,
    );
    const conflict = await this.hasConflict(
      dto.employeeId,
      appointment.appointmentDate,
      appointment.durationMinutes || 60,
      id,
    );
    if (conflict) {
      throw new BadRequestException(
        'Nhân viên đã có lịch hẹn trong khoảng thời gian này',
      );
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

    this.assertWorkingSlot(
      appointment.appointmentDate,
      appointment.durationMinutes || 60,
    );
    const conflict = await this.hasConflict(
      dto.employeeId,
      appointment.appointmentDate,
      appointment.durationMinutes || 60,
      id,
    );
    if (conflict)
      throw new BadRequestException(
        'Nhân viên đã có lịch hẹn vào thời điểm này',
      );

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
      const propertyTitle =
        appointment.house?.title || appointment.land?.title || '';
      const html = this.mailService.getApprovalEmailHtml(
        appointment.customer.user.fullName || 'Quý khách',
        formatDateTime(appointment.appointmentDate),
        propertyTitle,
      );
      this.mailProducer.sendMail(
        appointment.customer.user.email,
        'Lịch hẹn của bạn đã được duyệt - BĐS',
        html,
      );
    }

    // Gửi thông báo trong ứng dụng cho customer
    const customerUserId = appointment.customer?.userId as number | undefined;
    if (customerUserId) {
      const propertyTitle = appointment.house?.title || appointment.land?.title || '';
      void this.notificationService
        .notifyAppointmentApproved(customerUserId, id, propertyTitle, appointment.appointmentDate)
        .catch(() => null);
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
    if (appointment.status === 2)
      throw new BadRequestException('Lịch hẹn đã bị từ chối trước đó');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 2,
        ...(dto?.cancelReason && { cancelReason: dto.cancelReason }),
      },
      include: appointmentInclude,
    });

    if (appointment.customer?.user?.email) {
      const propertyTitle =
        appointment.house?.title || appointment.land?.title || '';
      const html = this.mailService.getCancellationEmailHtml(
        appointment.customer.user.fullName || 'Quý khách',
        formatDateTime(appointment.appointmentDate),
        propertyTitle,
        dto?.cancelReason,
      );
      this.mailProducer.sendMail(
        appointment.customer.user.email,
        'Lịch hẹn của bạn đã bị từ chối - BĐS',
        html,
      );
    }

    // Gửi thông báo trong ứng dụng cho customer
    const cancelCustomerUserId = appointment.customer?.userId as number | undefined;
    if (cancelCustomerUserId) {
      const propertyTitle = appointment.house?.title || appointment.land?.title || '';
      void this.notificationService
        .notifyAppointmentRejected(cancelCustomerUserId, id, propertyTitle, dto?.cancelReason)
        .catch(() => null);
    }

    return { message: 'Từ chối lịch hẹn thành công', data: updated };
  }

  async autoAssign(id: number, force = false) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        house: {
          select: { city: true, ward: true, district: true, employeeId: true },
        },
        land: {
          select: { city: true, ward: true, district: true, employeeId: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Lịch hẹn không tồn tại');
    }

    if (appointment.status === 2) {
      throw new BadRequestException(
        'Lịch hẹn đã bị từ chối, không thể auto-assign',
      );
    }

    if (appointment.employeeId && !force) {
      return { message: 'Lịch hẹn đã có nhân viên phụ trách', assigned: false };
    }

    const city = appointment.house?.city || appointment.land?.city || undefined;
    const ward =
      appointment.house?.ward ||
      appointment.land?.ward ||
      appointment.house?.district ||
      appointment.land?.district ||
      undefined;
    const durationMinutes = appointment.durationMinutes || 60;
    const preferredEmployeeId =
      appointment.house?.employeeId || appointment.land?.employeeId || undefined;
    this.assertWorkingSlot(appointment.appointmentDate, durationMinutes);

    const candidates = await this.buildAutoAssignCandidates(
      appointment.id,
      appointment.appointmentDate,
      durationMinutes,
      city,
      ward,
      preferredEmployeeId,
    );

    if (candidates.length === 0) {
      const suggestions = await this.suggestAlternativeSlots(
        appointment.id,
        appointment.appointmentDate,
        durationMinutes,
        city,
        ward,
        preferredEmployeeId,
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
        return {
          message: 'Lịch hẹn đã được gán bởi tiến trình khác',
          assigned: false,
        };
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
      message:
        preferredEmployeeId && best.employeeId === preferredEmployeeId
          ? `Đã auto-assign cho nhân viên quản lý #${best.employeeId}`
          : `Đã auto-assign cho nhân viên #${best.employeeId}`,
      assigned: true,
      reason: best.reason,
      data: assignedAppointment,
    };
  }

  async suggestSlots(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        house: {
          select: { city: true, ward: true, district: true, employeeId: true },
        },
        land: {
          select: { city: true, ward: true, district: true, employeeId: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Lịch hẹn không tồn tại');
    }

    const city = appointment.house?.city || appointment.land?.city || undefined;
    const ward =
      appointment.house?.ward ||
      appointment.land?.ward ||
      appointment.house?.district ||
      appointment.land?.district ||
      undefined;
    const preferredEmployeeId =
      appointment.house?.employeeId || appointment.land?.employeeId || undefined;

    return this.suggestAlternativeSlots(
      appointment.id,
      appointment.appointmentDate,
      appointment.durationMinutes || 60,
      city,
      ward,
      preferredEmployeeId,
    );
  }

  async getCalendarEvents(query: AppointmentCalendarQueryDto) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    const employeeId =
      query.employeeId !== undefined ? Number(query.employeeId) : undefined;

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ');
    }

    if (employeeId !== undefined && Number.isNaN(employeeId)) {
      throw new BadRequestException('Nhân viên lọc không hợp lệ');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 1,
        employeeId: {
          not: null,
          ...(employeeId ? { equals: employeeId } : {}),
        },
        appointmentDate: { gte: start, lt: end },
      },
      include: {
        customer: {
          include: { user: { select: { fullName: true, phone: true } } },
        },
        employee: { include: { user: { select: { fullName: true } } } },
        house: { select: { title: true, city: true, district: true } },
        land: { select: { title: true, city: true, district: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    return appointments.map((item) => {
      const title = item.house?.title || item.land?.title || 'Lịch hẹn';
      const customerName = item.customer?.user?.fullName || 'Khách hàng';
      const employeeName =
        item.employee?.user?.fullName || `NV #${item.employeeId}`;
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
      actualStatus: item.actualStatus, // ← thêm dòng này
      location: `${item.house?.district || item.land?.district || ''}, ${item.house?.city || item.land?.city || ''}`.replace(/^,\s*|,\s*$/g, ''),
    },
      };
    });
  }

  async moveCalendarAppointment(id: number, dto: MoveCalendarAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
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

    // [ADD] Validate 10 ngày khi điều phối lịch trên calendar
    this.assertBookingDateWithinLimit(nextDate);

    const nextEmployeeId = dto.employeeId || appointment.employeeId;
    if (!nextEmployeeId) {
      throw new BadRequestException('Lịch hẹn phải có nhân viên phụ trách');
    }

    const durationMinutes = appointment.durationMinutes || 60;
    this.assertWorkingSlot(nextDate, durationMinutes);

    const conflict = await this.hasConflict(
      nextEmployeeId,
      nextDate,
      durationMinutes,
      id,
    );
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
        entity?.house?.ward ||
        entity?.land?.ward ||
        entity?.house?.district ||
        entity?.land?.district ||
        undefined,
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
        autoAssignReason:
          dto.employeeId && dto.employeeId !== appointment.employeeId
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

  async markFirstContact(id: number, dto: MarkFirstContactDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Lịch hẹn không tồn tại');
    }

    const firstContactAt = dto.firstContactAt
      ? new Date(dto.firstContactAt)
      : new Date();
    const now = new Date();

    if (Number.isNaN(firstContactAt.getTime())) {
      throw new BadRequestException('firstContactAt không hợp lệ');
    }

    if (firstContactAt.getTime() > now.getTime()) {
      throw new BadRequestException(
        'Không thể cập nhật liên hệ đầu tiên ở tương lai',
      );
    }

    if (
      appointment.assignedAt &&
      firstContactAt.getTime() < appointment.assignedAt.getTime()
    ) {
      throw new BadRequestException(
        'Thời điểm liên hệ đầu tiên không được sớm hơn thời điểm phân công',
      );
    }

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

  async findByEmployee(employeeId: number, actor: AppointmentActor) {
    let effectiveEmployeeId = employeeId;

    if (this.isEmployeeRole(actor)) {
      const selfEmployeeId = await this.resolveEmployeeIdByUser(actor.id);
      if (selfEmployeeId !== employeeId) {
        throw new ForbiddenException(
          'Bạn chỉ được xem lịch hẹn của chính mình',
        );
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
          select: {
            title: true,
            city: true,
            district: true,
            ward: true,
            street: true,
            houseNumber: true,
            price: true,
            area: true,
            direction: true,
          },
        },
        land: {
          select: {
            title: true,
            city: true,
            district: true,
            ward: true,
            street: true,
            plotNumber: true,
            price: true,
            area: true,
            direction: true,
          },
        },
      },
    });
  }

  async findMyAssignedAppointments(actor: AppointmentActor) {
    const employeeId = await this.resolveEmployeeIdByUser(actor.id);
    return this.findByEmployee(employeeId, { ...actor, roles: ['EMPLOYEE'] });
  }

  async updateActualStatus(
    id: number,
    dto: UpdateActualStatusDto,
    actor: AppointmentActor,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { employee: { select: { id: true, userId: true } } },
    });
    if (!appointment) throw new NotFoundException('Lịch hẹn không tồn tại');
    if (appointment.status !== 1) {
      throw new BadRequestException(
        'Chỉ có thể cập nhật trạng thái thực tế cho lịch hẹn đã duyệt',
      );
    }
    if (!appointment.employeeId || !appointment.employee) {
      throw new BadRequestException('Lịch hẹn chưa được phân công nhân viên');
    }

    if (this.isEmployeeRole(actor)) {
      const selfEmployeeId = await this.resolveEmployeeIdByUser(actor.id);
      if (selfEmployeeId !== appointment.employeeId) {
        throw new ForbiddenException(
          'Bạn chỉ được cập nhật lịch hẹn được phân công cho mình',
        );
      }
    }

    const normalizedReason = dto.cancelReason?.trim();

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        actualStatus: dto.actualStatus,
        cancelReason: dto.actualStatus === 1 ? null : normalizedReason || null,
      },
    });

    return { message: 'Cập nhật trạng thái thực tế thành công', data: updated };
  }
 async findMyAppointments(userId: number, status?: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy thông tin khách hàng');

    const where: any = { customerId: customer.id };
    if (typeof status === 'number') {
      where.status = status;
    }

    return this.prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { appointmentDate: 'desc' },
    });
  }

  async findMyAppointmentById(appointmentId: number, userId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy thông tin khách hàng');

    const appointment = await this.prisma.appointment.findFirst({
      where: { 
        id: appointmentId, 
        customerId: customer.id 
      },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw new NotFoundException('Lịch hẹn không tồn tại hoặc không thuộc về bạn');
    }

    return appointment;
  }
// Thêm vào DepositService để sửa lỗi tại file cron.ts
async findExpiredDepositIds(now: Date): Promise<number[]> {
    const expiredDeposits = await this.prisma.propertyDeposit.findMany({
      where: {
        status: 1, // Trạng thái 1: Đang giữ chỗ (Active)
        expiresAt: {
          lt: now, // Thời gian hết hạn nhỏ hơn thời gian hiện tại
        },
      },
      select: { id: true },
    });

    return expiredDeposits.map((d) => d.id);
  }
async expireDeposit(depositId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const deposit = await tx.propertyDeposit.findUnique({
        where: { id: depositId },
        include: {
          appointment: {
            include: {
              house: { select: { id: true } },
              land: { select: { id: true } },
            },
          },
        },
      });

      // Nếu không tìm thấy hoặc đã được xử lý rồi thì bỏ qua
      if (!deposit || deposit.status !== 1) return;

      // 1. Cập nhật trạng thái Deposit thành Hết hạn (giả định status 5 là EXPIRED)
      await tx.propertyDeposit.update({
        where: { id: depositId },
        data: { status: 5 }, 
      });

      // 2. Giải phóng trạng thái bất động sản (depositStatus: 0 - Trống)
      const houseId = deposit.appointment.house?.id;
      const landId = deposit.appointment.land?.id;

      if (houseId) {
        await tx.house.update({
          where: { id: houseId },
          data: { depositStatus: 0 },
        });
      } else if (landId) {
        await tx.land.update({
          where: { id: landId },
          data: { depositStatus: 0 },
        });
      }

      console.log(`[Cron] Đã xử lý hết hạn giao dịch cọc ID: ${depositId}`);
    });
  }



async cancelMyAppointment(appointmentId: number, userId: number, dto?: CancelAppointmentDto) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    const appointment = await this.prisma.appointment.findFirst({
      where: { 
        id: appointmentId, 
        customerId: customer.id, 
        status: { in: [0, 1] } 
      },
    });

    if (!appointment) {
      throw new BadRequestException('Không thể hủy lịch này (đã từ chối hoặc không tồn tại)');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { 
        status: 2, 
        cancelReason: dto?.cancelReason?.trim() || null 
      },
      include: appointmentInclude,
    });

    return { 
      message: 'Hủy lịch hẹn thành công', 
      data: updated 
    };
  }
}