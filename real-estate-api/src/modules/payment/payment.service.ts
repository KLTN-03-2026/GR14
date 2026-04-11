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

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private vnpayService: VNPayService,
    private momoService: MoMoService,
    private mailService: MailService,
    private mailProducer: MailProducerService,
  ) {}

  async createPayment(dto: CreatePaymentDto, userId: number, ipAddr: string) {
    const vipPackage = await this.prisma.vipPackage.findUnique({
      where: { id: dto.packageId },
    });

    if (!vipPackage || vipPackage.status !== 1) {
      throw new NotFoundException('VIP package not found or inactive');
    }

    let finalPostId: number | undefined = undefined;

    // Sửa lỗi so sánh paymentType ở đây
    if (dto.paymentType === PaymentType.POST_VIP) {
      if (!dto.postId) {
        throw new BadRequestException(
          'Bắt buộc có postId cho gói VIP bài viết',
        );
      }
      finalPostId = Number(dto.postId);

      const post = await this.prisma.post.findFirst({
        where: { id: finalPostId, userId },
      });
      if (!post)
        throw new NotFoundException(
          'Post not found or you do not own this post',
        );
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
          amount: vipPackage.price,
          paymentMethod: dto.paymentMethod,
          paymentType: dto.paymentType,
          status: 0,
        },
      });

      let paymentUrl: string = '';
      const orderId = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const orderInfo = `Thanh toan goi VIP cho ${finalPostId ? 'bai dang ' + finalPostId : 'tai khoan'}`;

      if (dto.paymentMethod === 'vnpay') {
        // VNPay redirect trình duyệt về URL này. URL *.ngrok-free.app sẽ bị trang "Visit Site" (free tier).
        // Ưu tiên VNPAY_RETURN_URL (vd: http://localhost:5000/api/payment/vnpay/callback) khi test local.
        const vnpReturnUrl =
          process.env.VNPAY_RETURN_URL ||
          (process.env.NGROK_URL
            ? `${process.env.NGROK_URL.replace(/\/$/, '')}/api/payment/vnpay/callback`
            : undefined);
        paymentUrl = this.vnpayService.createPaymentUrl(
          orderId,
          Number(vipPackage.price),
          orderInfo,
          ipAddr,
          vnpReturnUrl,
        );
      } else if (dto.paymentMethod === 'momo') {
        const momoResponse = await this.momoService.createPaymentUrl(
          orderId,
          Number(vipPackage.price),
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
          amount: vipPackage.price,
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
          amount: vipPackage.price,
        },
      };
    });
  }
  private async activateSubscription(paymentId: number, subscription: any) {
    const now = new Date();
    const duration = subscription.package?.durationDays || 0;

    await this.prisma.$transaction(async (tx) => {
      let startDate = new Date();

      // Phân biệt VIP bài viết hay VIP tài khoản
      if (subscription.postId) {
        const post = await tx.post.findUnique({
          where: { id: subscription.postId },
        });
        if (post?.isVip && post.vipExpiry && post.vipExpiry > now) {
          startDate = new Date(post.vipExpiry);
        }
      } else {
        const user = await tx.user.findUnique({
          where: { id: subscription.userId },
        });
        if (user?.isVip && user.vipExpiry && user.vipExpiry > now) {
          startDate = new Date(user.vipExpiry);
        }
      }

      const endDate = new Date(
        startDate.getTime() + duration * 24 * 60 * 60 * 1000,
      );

      // Cập nhật Payment & Subscription
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 1, paidAt: now },
      });

      await tx.vipSubscription.update({
        where: { id: subscription.id },
        data: { status: 1, startDate: now, endDate: endDate },
      });

      // Cập nhật quyền lợi VIP
      if (subscription.postId) {
        await tx.post.update({
          where: { id: subscription.postId },
          // TS server đôi khi cache Prisma Client types; ép kiểu để tránh báo sai.
          data: {
            isVip: true,
            vipExpiry: endDate,
            vipPriorityLevel: subscription.package?.priorityLevel ?? 0,
            status: 1,
            postedAt: now,
          } as any,
        });
      } else {
        await tx.user.update({
          where: { id: subscription.userId },
          data: { isVip: true, vipExpiry: endDate },
        });
      }
    });
  }

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
        status:
          verification.isValid && responseCode === '00' ? 'success' : 'failed',
        responseCode: responseCode,
        responseData: JSON.stringify(vnp_Params),
      },
    });

    if (verification.isValid && responseCode === '00') {
      await this.activateSubscription(payment.id, payment.subscription);
      this.sendPaymentNotification(payment, true);
      return { success: true, message: 'Payment successful' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      await this.prisma.vipSubscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 3 },
      });
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
    if (!verification.isValid)
      return { RspCode: '97', Message: 'Invalid signature' };
    if (payment.status === 1)
      return { RspCode: '02', Message: 'Order already confirmed' };

    if (responseCode === '00') {
      await this.activateSubscription(payment.id, payment.subscription);
      this.sendPaymentNotification(payment, true);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      await this.prisma.vipSubscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 3 },
      });
    }

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async handleMoMoCallback(momoData: any) {
    const isValid = this.momoService.verifySignature(momoData);
    const transactionId = momoData.orderId;
    const resultCode = momoData.resultCode;

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
        status: isValid && resultCode === 0 ? 'success' : 'failed',
        responseCode: String(resultCode),
        responseData: JSON.stringify(momoData),
      },
    });

    if (isValid && resultCode === 0) {
      await this.activateSubscription(payment.id, payment.subscription);
      this.sendPaymentNotification(payment, true);
      return { success: true, message: 'Payment successful' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 2 },
      });
      await this.prisma.vipSubscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 3 },
      });
      this.sendPaymentNotification(payment, false);
      return { success: false, message: 'Payment failed' };
    }
  }

  async simulatePaymentSuccess(paymentId: number, userId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: { subscription: { include: { package: true } } },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 1)
      throw new BadRequestException('Payment already completed');

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
}
