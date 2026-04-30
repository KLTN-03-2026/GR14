import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VNPayService } from '../payment/services/vnpay.service';
import { MoMoService } from '../payment/services/momo.service';

// ─── Hằng số ───────────────────────────────────────────────────────────────
const AFTER_VIEWING_LOCK_DAYS = 3;
const CANCEL_BEFORE_VIEWING_REFUND_RATE = 0.95;

export interface ICreateDepositRequest {
  appointmentId: number;
  userId: number;
  amount: number;
  paymentMethod: string;
  returnUrl: string;
}

export interface IRequestRefund {
  depositId: number;
  userId: number;
  refundAccountInfo: string;
}

export interface IAdminProcessRefund {
  depositId: number;
  approve: boolean;
  adminNote?: string; // ← thêm vào đây
}

export interface ICompleteDeposit {
  depositId: number;
}

// ─── Service ───────────────────────────────────────────────────────────────
@Injectable()
export class DepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnpayService: VNPayService,
    private readonly momoService: MoMoService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private endOfDayVN(date: Date): Date {
    const d = new Date(date.getTime());
    d.setUTCHours(d.getUTCHours() + 7);
    d.setUTCHours(23, 59, 59, 999);
    d.setUTCHours(d.getUTCHours() - 7);
    return d;
  }

  private resolveDepositType(
    appointmentDate: Date,
    now = new Date(),
  ): 'BEFORE_VIEWING' | 'AFTER_VIEWING' {
    const appDay = new Date(
      appointmentDate.getFullYear(),
      appointmentDate.getMonth(),
      appointmentDate.getDate(),
    );
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return nowDay < appDay ? 'BEFORE_VIEWING' : 'AFTER_VIEWING';
  }

  private computeExpiresAt(
    depositType: 'BEFORE_VIEWING' | 'AFTER_VIEWING',
    appointmentDate: Date,
    now = new Date(),
  ): Date {
    if (depositType === 'BEFORE_VIEWING') {
      return this.endOfDayVN(this.addDays(appointmentDate, 1));
    }
    return this.addDays(now, AFTER_VIEWING_LOCK_DAYS);
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findById(depositId: number) {
    const deposit = await this.prisma.propertyDeposit.findUnique({
      where: { id: depositId },
      include: {
        appointment: {
          include: {
            house: { select: { id: true, title: true, depositStatus: true } },
            land: { select: { id: true, title: true, depositStatus: true } },
          },
        },
        payment: true,
      },
    });
    if (!deposit) throw new NotFoundException('Giao dịch cọc không tồn tại');
    return deposit;
  }

  async findByUser(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.propertyDeposit.findMany({
        where: { userId },
        include: {
          appointment: {
            include: {
              house: { select: { id: true, title: true } },
              land: { select: { id: true, title: true } },
            },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.propertyDeposit.count({ where: { userId } }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findAll(page: number = 1, limit: number = 10, status?: number) {
    const skip = (page - 1) * limit;
    const where = status !== undefined ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.propertyDeposit.findMany({
        where,
        include: {
          appointment: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.propertyDeposit.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  // deposit.service.ts - thêm method này vào sau findAll()

async findRefundRequests(page: number = 1, limit: number = 10, status?: number) {
  const skip = (page - 1) * limit;

  const where =
    status !== undefined
      ? { status }
      : { status: { in: [2, 3] }, refundAccountInfo: { not: null } };

  const [items, total] = await Promise.all([
    this.prisma.propertyDeposit.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        appointment: {
          include: {
            house: { select: { id: true, title: true } },
            land:  { select: { id: true, title: true } },
          },
        },
        payment: {
          select: { paymentMethod: true, transactionId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    this.prisma.propertyDeposit.count({ where }),
  ]);

  return {
    data: items,
    meta: { total, page, lastPage: Math.ceil(total / limit) },
  };
}


  async findExpiredDepositIds(now: Date): Promise<number[]> {
    const expired = await this.prisma.propertyDeposit.findMany({
      where: {
        status: 1,
        expiresAt: { lt: now },
      },
      select: { id: true },
    });
    return expired.map((d) => d.id);
  }

  // ── Luồng chính ────────────────────────────────────────────────────────────

  async createDepositRequest(dto: ICreateDepositRequest, ipAddr: string) {
    const { appointmentId, userId, amount, paymentMethod, returnUrl } = dto;
    const now = new Date();

    // ── Validate appointment ──────────────────────────────────────────────────
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        house: { select: { id: true, title: true, depositStatus: true } },
        land: { select: { id: true, title: true, depositStatus: true } },
        deposit: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Lịch hẹn không tồn tại');
    }

    const isApproved = appointment.status === 1;
    const isCompleted = appointment.actualStatus !== null;

    if (!isApproved && !isCompleted) {
      throw new BadRequestException(
        'Chỉ có thể đặt cọc cho lịch hẹn đã được duyệt hoặc đã diễn ra',
      );
    }

    if (appointment.deposit) {
      const s = appointment.deposit.status;
      if (s === 0 || s === 1) {
        throw new BadRequestException(
          'Lịch hẹn này đã có giao dịch cọc đang xử lý hoặc đang giữ chỗ',
        );
      }
    }

    const property = appointment.house || appointment.land;
    if (!property) {
      throw new BadRequestException('Lịch hẹn không gắn với bất động sản nào');
    }
    if (property.depositStatus === 1) {
      throw new BadRequestException(
        'Bất động sản này đang được giữ chỗ bởi khách hàng khác',
      );
    }

    const depositType = this.resolveDepositType(appointment.appointmentDate, now);
    const expiresAt = this.computeExpiresAt(
      depositType,
      appointment.appointmentDate,
      now,
    );

    // orderId bắt đầu bằng "DEP" để phân biệt với VIP ("VIP...")
    const orderId = `DEP${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Tạo deposit record
      const deposit = await tx.propertyDeposit.create({
        data: {
          appointmentId,
          userId,
          amount: Math.round(amount),
          depositType,
          expiresAt,
          status: 0,
        },
      });

      // 2. Tạo payment record
      const payment = await tx.payment.create({
        data: {
          depositId: deposit.id,
          userId,
          amount: Math.round(amount),
          paymentMethod,
          paymentType: 'PROPERTY_DEPOSIT',
          transactionId: orderId,
          status: 0,
        },
      });

      // 3. Tạo payment transaction
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          transactionId: orderId,
          amount: Math.round(amount),
          currency: 'VND',
          paymentMethod,
          status: 'pending',
        },
      });

      // 4. Tạo paymentUrl theo phương thức thanh toán
      let paymentUrl = '';
      const orderInfo = `Dat coc bat dong san - Lich hen #${appointmentId}`;

      if (paymentMethod === 'vnpay') {
        // VNPay: returnUrl là FE callback page (giống VIP)
        paymentUrl = this.vnpayService.createPaymentUrl(
          orderId,
          Math.round(amount),
          orderInfo,
          ipAddr,
        );
      } else if (paymentMethod === 'momo') {
        // MoMo: returnUrl là FE callback page
        const momoResponse = await this.momoService.createPaymentUrl(
          orderId,
          Math.round(amount),
          orderInfo,
          returnUrl,
        );
        paymentUrl = momoResponse.payUrl;
      } else if (paymentMethod === 'MOCK') {
        // Dev/test only
        paymentUrl = `${returnUrl}?vnp_ResponseCode=00&vnp_TxnRef=${orderId}`;
      } else {
        throw new BadRequestException('Phương thức thanh toán không hợp lệ');
      }

      // 5. Update paymentUrl vào payment
      await tx.payment.update({
        where: { id: payment.id },
        data: { paymentUrl },
      });

      return {
        message: 'Tạo yêu cầu đặt cọc thành công',
        data: {
          depositId: deposit.id,
          paymentId: payment.id,
          depositType,
          expiresAt,
          paymentUrl,
          transactionId: orderId,
        },
      };
    });
  }

  async handleDepositSuccess(depositId: number) {
    const deposit = await this.prisma.propertyDeposit.findUnique({
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

    if (!deposit) throw new NotFoundException('Giao dịch cọc không tồn tại');

    if (deposit.status !== 0) {
      return { message: 'Giao dịch cọc đã được xử lý', alreadyDone: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.propertyDeposit.update({
        where: { id: depositId },
        data: { status: 1 },
      });

      const houseId = deposit.appointment.house?.id;
      const landId = deposit.appointment.land?.id;

      if (houseId) {
        await tx.house.update({
          where: { id: houseId },
          data: { depositStatus: 1 },
        });
      } else if (landId) {
        await tx.land.update({
          where: { id: landId },
          data: { depositStatus: 1 },
        });
      }
    });

    return { message: 'Xác nhận đặt cọc thành công', depositId };
  }

  async requestRefund(dto: IRequestRefund) {
    const { depositId, userId, refundAccountInfo } = dto;
    const now = new Date();

    const deposit = await this.prisma.propertyDeposit.findUnique({
      where: { id: depositId },
      include: {
        appointment: { select: { appointmentDate: true } },
      },
    });

    if (!deposit) throw new NotFoundException('Giao dịch cọc không tồn tại');

    if (deposit.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên giao dịch này',
      );
    }

    if (deposit.status !== 1) {
      throw new BadRequestException(
        'Chỉ có thể yêu cầu hoàn tiền cho giao dịch đang giữ chỗ',
      );
    }

    if (deposit.depositType === 'AFTER_VIEWING') {
      throw new BadRequestException(
        'Tiền cọc sau khi xem không được hoàn lại. Bạn đã xem tận mắt bất động sản và xác nhận đặt cọc chốt mua.',
      );
    }

    const isBefore = now < deposit.appointment.appointmentDate;
    const refundAmount = isBefore
      ? Math.round(Number(deposit.amount) * CANCEL_BEFORE_VIEWING_REFUND_RATE)
      : Number(deposit.amount);

    await this.prisma.propertyDeposit.update({
      where: { id: depositId },
      data: {
        status: 2,
        refundAmount,
        refundAccountInfo: refundAccountInfo.trim(),
      },
    });

    return {
      message: 'Gửi yêu cầu hoàn tiền thành công, vui lòng chờ xử lý',
      data: { depositId, refundAmount },
    };
  }

async adminProcessRefund(dto: IAdminProcessRefund) {
  const { depositId, approve } = dto;

  const deposit = await this.prisma.propertyDeposit.findUnique({
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

  if (!deposit) throw new NotFoundException('Giao dịch cọc không tồn tại');

  if (deposit.status !== 2) {
    throw new BadRequestException(
      'Chỉ xử lý được yêu cầu hoàn tiền đang ở trạng thái chờ duyệt',
    );
  }

  if (approve) {
    await this.prisma.$transaction(async (tx) => {
      await tx.propertyDeposit.update({
        where: { id: depositId },
        data: {
          status: 3,
          refundedAt: new Date(),          // ← mới
          adminNote: dto.adminNote ?? null, // ← mới
        },
      });

      const houseId = deposit.appointment.house?.id;
      const landId = deposit.appointment.land?.id;

      if (houseId) {
        await tx.house.update({ where: { id: houseId }, data: { depositStatus: 0 } });
      } else if (landId) {
        await tx.land.update({ where: { id: landId }, data: { depositStatus: 0 } });
      }
    });

    return { message: 'Đã duyệt hoàn tiền thành công', depositId };
  } else {
    await this.prisma.propertyDeposit.update({
      where: { id: depositId },
      data: {
        status: 1,
        adminNote: dto.adminNote ?? null, // ← mới
      },
    });
    return { message: 'Đã từ chối yêu cầu hoàn tiền', depositId };
  }
}
  async completeDeposit(dto: ICompleteDeposit) {
    const { depositId } = dto;
    const deposit = await this.findById(depositId);

    if (deposit.status !== 1) {
      throw new BadRequestException(
        'Chỉ có thể hoàn tất giao dịch đang ở trạng thái giữ chỗ',
      );
    }

    return await this.prisma.propertyDeposit.update({
      where: { id: depositId },
      data: { status: 4 },
    });
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

      if (!deposit || deposit.status !== 1) return;

      await tx.propertyDeposit.update({
        where: { id: depositId },
        data: { status: 5 },
      });

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
    });
  }
  

}