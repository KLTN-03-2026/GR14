import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VNPayService } from './services/vnpay.service';
import { MoMoService } from './services/momo.service';
import { CreatePaymentDto, PaymentType } from './dto/payment.dto';
import { MailService } from '../../common/mail/mail.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { DepositService } from '../deposit/deposit.service';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private vnpayService: VNPayService,
    private momoService: MoMoService,
    private mailService: MailService,
    private mailProducer: MailProducerService,
    private depositService: DepositService,
  ) {}

  async createPayment(dto: CreatePaymentDto, userId: number, ipAddr: string) {
    const vipPackage = await this.prisma.vipPackage.findUnique({
      where: { id: dto.packageId },
    });

    if (!vipPackage || vipPackage.status !== 1) {
      throw new NotFoundException('VIP package not found or inactive');
    }

    if (vipPackage.packageType !== String(dto.paymentType)) {
      throw new BadRequestException(
        `Loại thanh toán không khớp với loại gói (${vipPackage.packageType})`,
      );
    }

    const resolvedAmount = Number(vipPackage.price);

    let finalPostId: number | undefined = undefined;

    if (dto.paymentType === PaymentType.POST_VIP) {
      if (!dto.postId) {
        throw new BadRequestException('Bắt buộc có postId cho gói VIP bài viết');
      }
      finalPostId = Number(dto.postId);

      const post = await this.prisma.post.findFirst({
        where: { id: finalPostId, userId },
      });
      if (!post)
        throw new NotFoundException('Post not found or you do not own this post');

      if (post.isVip && post.vipExpiry && post.vipExpiry > new Date()) {
        if ((post.vipPriorityLevel ?? 0) > vipPackage.priorityLevel) {
          throw new BadRequestException(
            `Bài đăng đang sử dụng gói VIP cao hơn (Mức ${post.vipPriorityLevel}), không thể gia hạn bằng gói cấp thấp hơn.`,
          );
        }
      }
    } else if (dto.paymentType === String(PaymentType.ACCOUNT_VIP)) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (dbUser?.isVip && dbUser.vipExpiry && dbUser.vipExpiry > new Date()) {
        if ((dbUser.vipPriorityLevel ?? 0) > vipPackage.priorityLevel) {
          throw new BadRequestException(
            `Tài khoản đang dùng VIP Mức ${dbUser.vipPriorityLevel}, không thể gia hạn bằng gói Mức ${vipPackage.priorityLevel}.`,
          );
        }
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.vipSubscription.create({
        data: {
          packageId: dto.packageId,
          userId: userId,
          status: 0,
          ...(finalPostId && { postId: finalPostId }),
        },
      });

      const payment = await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: userId,
          amount: resolvedAmount,
          paymentMethod: dto.paymentMethod,
          paymentType: dto.paymentType,
          status: 0,
        },
      });

      let paymentUrl: string = '';
      const orderId = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const orderInfo = `Thanh toan goi VIP cho ${finalPostId ? 'bai dang ' + finalPostId : 'tai khoan'}`;

      if (dto.paymentMethod === 'vnpay') {
        paymentUrl = this.vnpayService.createPaymentUrl(
          orderId,
          resolvedAmount,
          orderInfo,
          ipAddr,
        );
      } else if (dto.paymentMethod === 'momo') {
        const momoResponse = await this.momoService.createPaymentUrl(
          orderId,
          resolvedAmount,
          orderInfo,
          dto.returnUrl,
        );
        paymentUrl = momoResponse.payUrl;
      } else if (dto.paymentMethod === 'MOCK') {
        paymentUrl = `${dto.returnUrl}?vnp_ResponseCode=00&vnp_TxnRef=${orderId}`;
      } else {
        throw new BadRequestException('Invalid payment method');
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { paymentUrl, transactionId: orderId },
      });

      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          transactionId: orderId,
          amount: resolvedAmount,
          currency: 'VND',
          paymentMethod: dto.paymentMethod,
          status: 'pending',
        },
      });

      return {
        message: 'Payment created successfully',
        data: {
          paymentId: updatedPayment.id,
          subscriptionId: subscription.id,
          paymentUrl,
          amount: resolvedAmount,
        },
      };
    });
  }

  // ── Activate VIP Subscription ─────────────────────────────────────────────

  private async activateSubscription(paymentId: number, subscription: any) {
    const now = new Date();
    const duration = subscription.package?.durationDays || 0;

    await this.prisma.$transaction(async (tx) => {
      let startDate = new Date();
      const newPriorityLevel = subscription.package?.priorityLevel ?? 0;

      if (subscription.postId) {
        const post = await tx.post.findUnique({
          where: { id: subscription.postId },
        });
        if (post?.isVip && post.vipExpiry && post.vipExpiry > now) {
          if (newPriorityLevel > (post.vipPriorityLevel ?? 0)) {
            startDate = now;
          } else {
            startDate = new Date(post.vipExpiry);
          }
        }
      } else {
        const user = await tx.user.findUnique({
          where: { id: subscription.userId },
        });
        if (user?.isVip && user.vipExpiry && user.vipExpiry > now) {
          if (newPriorityLevel > (user.vipPriorityLevel ?? 0)) {
            startDate = now;
          } else {
            startDate = new Date(user.vipExpiry);
          }
        }
      }

      const endDate = new Date(
        startDate.getTime() + duration * 24 * 60 * 60 * 1000,
      );

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 1, paidAt: now },
      });

      await tx.vipSubscription.update({
        where: { id: subscription.id },
        data: { status: 1, startDate: now, endDate: endDate },
      });

      if (subscription.postId) {
        await tx.post.update({
          where: { id: subscription.postId },
          data: {
            isVip: true,
            vipExpiry: endDate,
            vipPriorityLevel: newPriorityLevel,
            status: 1,
            postedAt: now,
          },
        });
      } else {
        await tx.user.update({
          where: { id: subscription.userId },
          data: {
            isVip: true,
            vipExpiry: endDate,
            vipPriorityLevel: newPriorityLevel,
          },
        });

        // Cập nhật an toàn: không đè lên các bài đăng đã mua VIP riêng đắt tiền hơn
        await tx.post.updateMany({
          where: {
            userId: subscription.userId,
            OR: [
              { isVip: false },
              { vipExpiry: { lt: now } },
              { vipPriorityLevel: { lt: newPriorityLevel } },
            ],
          },
          data: {
            isVip: true,
            vipExpiry: endDate,
            vipPriorityLevel: newPriorityLevel,
          },
        });
      }
    });
  }

  // ── Activate Deposit ──────────────────────────────────────────────────────

  private async activateDeposit(paymentId: number, payment: any) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 1, paidAt: now },
      });
    });

    if (payment.depositId) {
      await this.depositService.handleDepositSuccess(payment.depositId);
    }
  }

  // ── VNPay ─────────────────────────────────────────────────────────────────

  async handleVNPayCallback(vnp_Params: any) {
    const verification = this.vnpayService.verifyReturnUrl(vnp_Params);
    const transactionId = vnp_Params.vnp_TxnRef;
    const responseCode = vnp_Params.vnp_ResponseCode;

    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: {
        subscription: {
          include: { package: true, post: { select: { title: true } } },
        },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 1)
      return { success: true, message: 'Payment already successful' };

    await this.prisma.paymentTransaction.updateMany({
      where: { transactionId },
      data: {
        status: verification.isValid && responseCode === '00' ? 'success' : 'failed',
        responseCode: responseCode,
        responseData: JSON.stringify(vnp_Params),
      },
    });

    if (verification.isValid && responseCode === '00') {
      if (payment.paymentType === 'PROPERTY_DEPOSIT') {
        await this.activateDeposit(payment.id, payment);
        this.sendDepositPaymentNotification(payment, true);
      } else {
        await this.activateSubscription(payment.id, payment.subscription);
        this.sendPaymentNotification(payment, true);
      }
      return { success: true, message: 'Payment successful' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      if (payment.paymentType !== 'PROPERTY_DEPOSIT' && payment.subscription) {
        await this.prisma.vipSubscription.update({
          where: { id: payment.subscriptionId! },
          data: { status: 3 },
        });
      }
      this.sendPaymentNotification(payment, false);
      return { success: false, message: 'Payment failed' };
    }
  }

  async handleVNPayIPN(vnp_Params: any) {
    const verification = this.vnpayService.verifyReturnUrl(vnp_Params);
    const transactionId = vnp_Params.vnp_TxnRef;
    const responseCode = vnp_Params.vnp_ResponseCode;

    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: {
        subscription: {
          include: { package: true, post: { select: { title: true } } },
        },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    if (!verification.isValid) return { RspCode: '97', Message: 'Invalid signature' };
    if (payment.status === 1) return { RspCode: '02', Message: 'Order already confirmed' };

    if (responseCode === '00') {
      if (payment.paymentType === 'PROPERTY_DEPOSIT') {
        await this.activateDeposit(payment.id, payment);
        this.sendDepositPaymentNotification(payment, true);
      } else {
        await this.activateSubscription(payment.id, payment.subscription);
        this.sendPaymentNotification(payment, true);
      }
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      if (payment.paymentType !== 'PROPERTY_DEPOSIT' && payment.subscription) {
        await this.prisma.vipSubscription.update({
          where: { id: payment.subscriptionId! },
          data: { status: 3 },
        });
      }
    }

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // ── MoMo ──────────────────────────────────────────────────────────────────

  async handleMoMoCallback(momoData: any) {
    const transactionId = momoData.orderId;
    const resultCode = Number(momoData.resultCode);

    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: {
        subscription: {
          include: { package: true, post: { select: { title: true } } },
        },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 1) return { success: true, message: 'Payment successful' };
    if (payment.status === 2) return { success: false, message: 'Payment failed' };

    if (resultCode === 0) {
      if (payment.paymentType === 'PROPERTY_DEPOSIT') {
        await this.activateDeposit(payment.id, payment);
        this.sendDepositPaymentNotification(payment, true);
      } else {
        await this.activateSubscription(payment.id, payment.subscription);
        this.sendPaymentNotification(payment, true);
      }
      return { success: true, message: 'Payment successful' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      if (payment.paymentType !== 'PROPERTY_DEPOSIT' && payment.subscription) {
        await this.prisma.vipSubscription.update({
          where: { id: payment.subscriptionId! },
          data: { status: 3 },
        });
      }
      this.sendPaymentNotification(payment, false);
      return { success: false, message: 'Payment failed' };
    }
  }

  async handleMoMoIPN(momoData: any) {
    const isValid = this.momoService.verifySignature(momoData);
    const transactionId = momoData.orderId;
    const resultCode = momoData.resultCode;

    if (!isValid) return { message: 'Invalid signature' };

    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: {
        subscription: {
          include: { package: true, post: { select: { title: true } } },
        },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!payment) return { message: 'Payment not found' };
    if (payment.status === 1) return { message: 'Payment already confirmed' };

    await this.prisma.paymentTransaction.updateMany({
      where: { transactionId },
      data: {
        status: resultCode === 0 ? 'success' : 'failed',
        responseCode: String(resultCode),
        responseData: JSON.stringify(momoData),
      },
    });

    if (resultCode === 0) {
      if (payment.paymentType === 'PROPERTY_DEPOSIT') {
        await this.activateDeposit(payment.id, payment);
        this.sendDepositPaymentNotification(payment, true);
      } else {
        await this.activateSubscription(payment.id, payment.subscription);
        this.sendPaymentNotification(payment, true);
      }
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      if (payment.paymentType !== 'PROPERTY_DEPOSIT' && payment.subscription) {
        await this.prisma.vipSubscription.update({
          where: { id: payment.subscriptionId! },
          data: { status: 3 },
        });
      }
    }

    return { message: 'IPN received' };
  }

  // ── Simulate (dev/test) ───────────────────────────────────────────────────

  async simulatePaymentSuccess(paymentId: number, userId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        subscription: { include: { package: true } },
        deposit: true,
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 1)
      throw new BadRequestException('Payment already completed');

    if (payment.paymentType === 'PROPERTY_DEPOSIT') {
      await this.activateDeposit(payment.id, payment);
      return {
        success: true,
        message: 'Deposit payment simulated successfully',
        data: { depositId: payment.depositId! },
      };
    }

    if (!payment.subscription) {
      throw new BadRequestException('Không tìm thấy subscription cho payment này');
    }

    await this.activateSubscription(payment.id, payment.subscription);

    return {
      success: true,
      message: 'Payment simulated successfully',
      data: {
        postId: payment.subscription.postId,
        packageName: payment.subscription.package.name,
      },
    };
  }

  // ── Notification helpers ──────────────────────────────────────────────────

  private sendPaymentNotification(payment: any, isSuccess: boolean) {
    if (!payment?.user?.email) return;

    const packageName = payment.subscription?.package?.name || 'Gói VIP';
    const postTitle = payment.subscription?.post?.title;
    const amount = Number(payment.amount || 0);
    const method = payment.paymentMethod;

    const html = isSuccess
      ? this.mailService.getPaymentSuccessEmailHtml(
          payment.user.fullName || 'Quý khách',
          amount,
          packageName,
          postTitle,
          method,
        )
      : this.mailService.getPaymentFailureEmailHtml(
          payment.user.fullName || 'Quý khách',
          amount,
          packageName,
          postTitle,
          method,
        );

    this.mailProducer.sendMail(
      payment.user.email,
      isSuccess ? 'Thanh toán VIP thành công' : 'Thanh toán VIP thất bại',
      html,
    );
  }

  private sendDepositPaymentNotification(payment: any, isSuccess: boolean) {
    if (!payment?.user?.email) return;

    const amount = Number(payment.amount || 0);
    const method = payment.paymentMethod;

    const html = isSuccess
      ? this.mailService.getPaymentSuccessEmailHtml(
          payment.user.fullName || 'Quý khách',
          amount,
          'Đặt cọc bất động sản',
          undefined,
          method,
        )
      : this.mailService.getPaymentFailureEmailHtml(
          payment.user.fullName || 'Quý khách',
          amount,
          'Đặt cọc bất động sản',
          undefined,
          method,
        );

    this.mailProducer.sendMail(
      payment.user.email,
      isSuccess ? 'Đặt cọc bất động sản thành công' : 'Thanh toán đặt cọc thất bại',
      html,
    );
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getPaymentById(id: number, userId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: { subscription: { include: { package: true, post: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return { data: payment };
  }

  async getMyPayments(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        include: {
          subscription: {
            include: {
              package: true,
              post: {
                select: { id: true, title: true, city: true, district: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return {
      data: payments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllPayments(
    page = 1,
    limit = 10,
    search?: string,
    method?: string,
    status?: string,
    type?: string, 
    startDate?: string,
    endDate?: string,
  ) {
    const skip = (page - 1) * limit;
    const whereCondition: any = {};

    if (search) {
      whereCondition.user = {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    if (method) whereCondition.paymentMethod = method;
    
    if (status !== undefined && status !== '') {
      whereCondition.status = parseInt(status);
    }
    if (type)   whereCondition.paymentType = type;
    if (startDate || endDate) {
      whereCondition.createdAt = {};
      if (startDate) whereCondition.createdAt.gte = new Date(startDate);
      if (endDate) whereCondition.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: whereCondition,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          subscription: {
            include: {
              package: { select: { id: true, name: true } },
              post: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: whereCondition }),
    ]);

    return {
      data: payments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async initiatePostVipUpgrade(postId: number, userId: number) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại hoặc bạn không có quyền');
    if (post.isVip) throw new BadRequestException('Bài đăng đã là VIP');

    return {
      message: 'Vui lòng chọn gói VIP cho bài đăng',
      data: { postId, postTitle: post.title },
    };
  }
  async getRevenueStats(
  startDate?: string,
  endDate?: string,
  groupBy: 'day' | 'month' | 'year' = 'month',
) {
  const start = startDate ? new Date(startDate) : this.getDefaultStartDate(groupBy);
  const end   = endDate   ? new Date(endDate)   : new Date();
 
  // 1. Aggregate theo loại payment (chỉ status = 1 — đã thành công)
  const [accountVipAgg, postVipAgg, depositAgg] = await Promise.all([
    this.prisma.payment.aggregate({
      where: { status: 1, paymentType: 'ACCOUNT_VIP', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    this.prisma.payment.aggregate({
      where: { status: 1, paymentType: 'POST_VIP', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    this.prisma.payment.aggregate({
      where: { status: 1, paymentType: 'PROPERTY_DEPOSIT', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);
 
  // 2. Đếm trạng thái giao dịch
  const [successCount, failedCount, pendingCount] = await Promise.all([
    this.prisma.payment.count({ where: { status: 1, createdAt: { gte: start, lte: end } } }),
    this.prisma.payment.count({ where: { status: 2, createdAt: { gte: start, lte: end } } }),
    this.prisma.payment.count({ where: { status: 0, createdAt: { gte: start, lte: end } } }),
  ]);
 
  // 3. Breakdown theo phương thức thanh toán
  const methodBreakdown = await this.prisma.payment.groupBy({
    by: ['paymentMethod'],
    where: { status: 1, createdAt: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: { id: true },
  });
 
  // 4. Chart data theo time bucket
  const chartData = await this.getChartData(start, end, groupBy);
 
  // 5. So sánh với kỳ trước
  const comparison = await this.getComparisonData(start, end);
 
  const totalRevenue =
    Number(accountVipAgg._sum.amount ?? 0) +
    Number(postVipAgg._sum.amount   ?? 0) +
    Number(depositAgg._sum.amount   ?? 0);
 
  const totalTx = successCount + failedCount + pendingCount;
 
  return {
    data: {
      summary: {
        totalRevenue,
        accountVip: {
          revenue: Number(accountVipAgg._sum.amount ?? 0),
          count:   accountVipAgg._count.id,
        },
        postVip: {
          revenue: Number(postVipAgg._sum.amount ?? 0),
          count:   postVipAgg._count.id,
        },
        deposit: {
          revenue: Number(depositAgg._sum.amount ?? 0),
          count:   depositAgg._count.id,
        },
      },
      transactionStatus: {
        success:     successCount,
        failed:      failedCount,
        pending:     pendingCount,
        total:       totalTx,
        successRate: totalTx > 0 ? Math.round((successCount / totalTx) * 100) : 0,
      },
      methodBreakdown: methodBreakdown.map((m) => ({
        method:  m.paymentMethod,
        revenue: Number(m._sum.amount ?? 0),
        count:   m._count.id,
      })),
      chartData,
      comparison,
      period: { startDate: start, endDate: end, groupBy },
    },
  };
}
 
// ── getChartData: group payments vào buckets day/month/year ──────────────────
private async getChartData(
  start: Date,
  end: Date,
  groupBy: 'day' | 'month' | 'year',
) {
  const payments = await this.prisma.payment.findMany({
    where: { status: 1, createdAt: { gte: start, lte: end } },
    select: { amount: true, paymentType: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
 
  const buckets = new Map<string, {
    label: string;
    accountVip: number;
    postVip: number;
    deposit: number;
    total: number;
  }>();
 
  for (const p of payments) {
    const key = this.getTimeKey(p.createdAt, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, { label: key, accountVip: 0, postVip: 0, deposit: 0, total: 0 });
    }
    const b = buckets.get(key)!;
    const amount = Number(p.amount);
    b.total += amount;
    if (p.paymentType === 'ACCOUNT_VIP')          b.accountVip += amount;
    else if (p.paymentType === 'POST_VIP')          b.postVip    += amount;
    else if (p.paymentType === 'PROPERTY_DEPOSIT')  b.deposit    += amount;
  }
 
  return Array.from(buckets.values());
}
 
// ── getComparisonData: so sánh kỳ hiện tại vs kỳ trước tương đương ──────────
private async getComparisonData(start: Date, end: Date) {
  const duration  = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);
  const prevEnd   = new Date(start.getTime() - 1);
 
  const [curr, prev] = await Promise.all([
    this.prisma.payment.aggregate({
      where: { status: 1, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    this.prisma.payment.aggregate({
      where: { status: 1, createdAt: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);
 
  const currRev = Number(curr._sum.amount ?? 0);
  const prevRev = Number(prev._sum.amount ?? 0);
 
  return {
    currentPeriod:  { revenue: currRev,  count: curr._count.id },
    previousPeriod: { revenue: prevRev,  count: prev._count.id },
    revenueChange:
      prevRev > 0 ? Math.round(((currRev - prevRev) / prevRev) * 100) : null,
    countChange:
      prev._count.id > 0
        ? Math.round(((curr._count.id - prev._count.id) / prev._count.id) * 100)
        : null,
  };
}
 
// ── helpers ───────────────────────────────────────────────────────────────────
private getTimeKey(date: Date, groupBy: 'day' | 'month' | 'year'): string {
  const d = new Date(date);
  if (groupBy === 'day')   return d.toISOString().slice(0, 10);
  if (groupBy === 'month') return d.toISOString().slice(0, 7);
  return String(d.getFullYear());
}
 
private getDefaultStartDate(groupBy: 'day' | 'month' | 'year'): Date {
  const d = new Date();
  if (groupBy === 'day')   { d.setDate(d.getDate() - 30);    return d; }
  if (groupBy === 'month') { d.setMonth(d.getMonth() - 12);  return d; }
  d.setFullYear(d.getFullYear() - 5);
  return d;
}
}