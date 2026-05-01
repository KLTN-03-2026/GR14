import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VNPayService } from '../payment/services/vnpay.service';
import { MoMoService } from '../payment/services/momo.service';
import { MailService } from '../../common/mail/mail.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { NotificationService } from '../notification/notification.service';

// ─── Hằng số ───────────────────────────────────────────────────────────────
const AFTER_VIEWING_LOCK_DAYS = 3;
const CANCEL_BEFORE_VIEWING_REFUND_RATE = 0.95; // Huỷ trước ngày hẹn → hoàn 95%
const CANCEL_AFTER_VIEWING_REFUND_RATE = 0.50;  // Huỷ sau ngày hẹn  → hoàn 50%
const PENDING_DEPOSIT_TTL_MINUTES = 30;          // Fix #2: Deposit pending quá 30 phút → tự cleanup
const MIN_DEPOSIT_AMOUNT = 1_000_000;            // Fix #6: Tối thiểu 1 triệu VND
const MAX_DEPOSIT_RATE = 0.30;                   // Fix #6: Tối đa 30% giá BĐS

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
  adminNote?: string;
}

export interface ICompleteDeposit {
  depositId: number;
}

// ─── Service ───────────────────────────────────────────────────────────────
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vnpayService: VNPayService,
    private readonly momoService: MoMoService,
    private readonly mailService: MailService,
    private readonly mailProducer: MailProducerService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Fix #11: Simplified endOfDayVN — uses UTC offset directly without double conversion
  private endOfDayVN(date: Date): Date {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    // Convert to VN time, set to 23:59:59.999, convert back to UTC
    const vnTime = new Date(date.getTime() + VN_OFFSET_MS);
    vnTime.setUTCHours(23, 59, 59, 999);
    return new Date(vnTime.getTime() - VN_OFFSET_MS);
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

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
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
          user: { select: { id: true, fullName: true, email: true, phone: true } },
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
      this.prisma.propertyDeposit.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

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
              land: { select: { id: true, title: true } },
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

  // Fix #2: Tìm deposit pending (status=0) quá thời hạn → cleanup
  async findStalePendingDepositIds(now: Date): Promise<number[]> {
    const cutoff = new Date(now.getTime() - PENDING_DEPOSIT_TTL_MINUTES * 60 * 1000);
    const stale = await this.prisma.propertyDeposit.findMany({
      where: {
        status: 0,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });
    return stale.map((d) => d.id);
  }

  // Fix #2: Cleanup một deposit pending (xoá payment + deposit)
  async cleanupStalePendingDeposit(depositId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Tìm payment liên quan
      const payment = await tx.payment.findFirst({ where: { depositId } });
      if (payment) {
        // Xoá paymentTransaction trước
        await tx.paymentTransaction.deleteMany({ where: { paymentId: payment.id } });
        // Xoá payment
        await tx.payment.delete({ where: { id: payment.id } });
      }
      // Cuối cùng xoá deposit
      await tx.propertyDeposit.delete({ where: { id: depositId } });
    });
  }

  // ── Luồng chính ────────────────────────────────────────────────────────────

  async createDepositRequest(dto: ICreateDepositRequest, ipAddr: string) {
    const { appointmentId, userId, amount, paymentMethod, returnUrl } = dto;
    const now = new Date();

    // Fix #6: Validate amount tối thiểu
    if (amount < MIN_DEPOSIT_AMOUNT) {
      throw new BadRequestException(
        `Số tiền đặt cọc tối thiểu là ${this.formatCurrency(MIN_DEPOSIT_AMOUNT)}`,
      );
    }

    // ── Validate appointment ──────────────────────────────────────────────────
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        house: { select: { id: true, title: true, depositStatus: true, price: true } },
        land: { select: { id: true, title: true, depositStatus: true, price: true } },
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

    // Fix #2: Tự cleanup deposit pending cũ trước khi check
    if (appointment.deposit) {
      const s = appointment.deposit.status;
      if (s === 0) {
        // Deposit pending quá hạn → tự cleanup
        const ageMs = now.getTime() - new Date(appointment.deposit.createdAt).getTime();
        if (ageMs > PENDING_DEPOSIT_TTL_MINUTES * 60 * 1000) {
          await this.cleanupStalePendingDeposit(appointment.deposit.id);
          this.logger.log(`Cleaned up stale pending deposit #${appointment.deposit.id}`);
        } else {
          throw new BadRequestException(
            'Lịch hẹn này đã có giao dịch cọc đang chờ thanh toán. Vui lòng hoàn tất hoặc đợi hết hạn.',
          );
        }
      } else if (s === 1) {
        throw new BadRequestException(
          'Lịch hẹn này đã có giao dịch cọc đang giữ chỗ',
        );
      }
    }

    const property = appointment.house || appointment.land;
    if (!property) {
      throw new BadRequestException('Lịch hẹn không gắn với bất động sản nào');
    }

    // Fix #6: Validate amount tối đa (30% giá BĐS)
    const propertyPrice = Number(property.price || 0);
    if (propertyPrice > 0) {
      const maxAmount = Math.round(propertyPrice * MAX_DEPOSIT_RATE);
      if (amount > maxAmount) {
        throw new BadRequestException(
          `Số tiền đặt cọc tối đa là ${this.formatCurrency(maxAmount)} (30% giá BĐS)`,
        );
      }
    }

    // Fix #5: Di chuyển check depositStatus vào trong transaction + lock row
    const depositType = this.resolveDepositType(appointment.appointmentDate, now);
    const expiresAt = this.computeExpiresAt(
      depositType,
      appointment.appointmentDate,
      now,
    );

    const orderId = `DEP${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    return await this.prisma.$transaction(async (tx) => {
      // Fix #5: Lock row bên trong transaction để tránh race condition
      if (appointment.house?.id) {
        const house = await tx.house.findUnique({
          where: { id: appointment.house.id },
          select: { depositStatus: true },
        });
        if (house?.depositStatus === 1) {
          throw new BadRequestException('Bất động sản này đang được giữ chỗ bởi khách hàng khác');
        }
      } else if (appointment.land?.id) {
        const land = await tx.land.findUnique({
          where: { id: appointment.land.id },
          select: { depositStatus: true },
        });
        if (land?.depositStatus === 1) {
          throw new BadRequestException('Bất động sản này đang được giữ chỗ bởi khách hàng khác');
        }
      }

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
        paymentUrl = this.vnpayService.createPaymentUrl(
          orderId,
          Math.round(amount),
          orderInfo,
          ipAddr,
        );
      } else if (paymentMethod === 'momo') {
        const momoResponse = await this.momoService.createPaymentUrl(
          orderId,
          Math.round(amount),
          orderInfo,
          returnUrl,
        );
        paymentUrl = momoResponse.payUrl;
      } else if (paymentMethod === 'MOCK') {
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
    const refundRate = isBefore
      ? CANCEL_BEFORE_VIEWING_REFUND_RATE   // Chưa xem → hoàn 95%
      : CANCEL_AFTER_VIEWING_REFUND_RATE;   // Đã qua ngày hẹn → hoàn 50%
    const refundAmount = Math.round(Number(deposit.amount) * refundRate);

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

  // Fix #8: Thêm mail + notification khi admin xử lý hoàn tiền
  async adminProcessRefund(dto: IAdminProcessRefund) {
    const { depositId, approve } = dto;

    const deposit = await this.prisma.propertyDeposit.findUnique({
      where: { id: depositId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        appointment: {
          include: {
            house: { select: { id: true, title: true } },
            land: { select: { id: true, title: true } },
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

    const propertyTitle =
      deposit.appointment.house?.title ||
      deposit.appointment.land?.title ||
      'Bất động sản';
    const userName = deposit.user?.fullName || 'Quý khách';
    const userEmail = deposit.user?.email;
    const userId = deposit.user?.id;

    if (approve) {
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyDeposit.update({
          where: { id: depositId },
          data: {
            status: 3,
            refundedAt: new Date(),
            adminNote: dto.adminNote ?? null,
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

      // Fix #8: Gửi mail thông báo duyệt hoàn tiền
      if (userEmail) {
        const refundAmount = Number(deposit.refundAmount || deposit.amount);
        const html = this.mailService.getPaymentSuccessEmailHtml(
          userName,
          refundAmount,
          `Hoàn tiền đặt cọc - ${propertyTitle}`,
          undefined,
          undefined,
        );
        this.mailProducer.sendMail(userEmail, 'Yêu cầu hoàn tiền đã được duyệt ✅', html);
      }

      // Fix #8: Gửi notification
      if (userId) {
        this.notificationService.create({
          userId,
          type: 'SYSTEM',
          title: 'Hoàn tiền đã được duyệt ✅',
          message: `Yêu cầu hoàn tiền đặt cọc "${propertyTitle}" đã được duyệt. Số tiền ${this.formatCurrency(Number(deposit.refundAmount || deposit.amount))} sẽ được chuyển về tài khoản của bạn.`,
        }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
      }

      return { message: 'Đã duyệt hoàn tiền thành công', depositId };
    } else {
      await this.prisma.propertyDeposit.update({
        where: { id: depositId },
        data: {
          status: 1,
          adminNote: dto.adminNote ?? null,
        },
      });

      // Fix #8: Gửi mail thông báo từ chối hoàn tiền
      if (userEmail) {
        const noteText = dto.adminNote ? `\nLý do: ${dto.adminNote}` : '';
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
            <h2 style="color:#ff4d4f;">❌ Yêu cầu hoàn tiền bị từ chối</h2>
            <p>Kính gửi <strong>${userName}</strong>,</p>
            <p>Yêu cầu hoàn tiền đặt cọc cho "<strong>${propertyTitle}</strong>" đã bị từ chối.${noteText}</p>
            <p>Giao dịch cọc của bạn vẫn đang trong trạng thái giữ chỗ. Nếu cần hỗ trợ, vui lòng liên hệ đội ngũ CSKH.</p>
            <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
          </div>
        `;
        this.mailProducer.sendMail(userEmail, 'Yêu cầu hoàn tiền bị từ chối ❌', html);
      }

      // Fix #8: Gửi notification
      if (userId) {
        const noteMsg = dto.adminNote ? ` Lý do: ${dto.adminNote}` : '';
        this.notificationService.create({
          userId,
          type: 'SYSTEM',
          title: 'Yêu cầu hoàn tiền bị từ chối ❌',
          message: `Yêu cầu hoàn tiền đặt cọc "${propertyTitle}" đã bị từ chối.${noteMsg} Giao dịch cọc vẫn đang giữ chỗ.`,
        }).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
      }

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