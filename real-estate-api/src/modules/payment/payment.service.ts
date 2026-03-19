import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VNPayService } from './services/vnpay.service';
import { MoMoService } from './services/momo.service';
import { CreatePaymentDto } from './dto/payment.dto';
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
    ) { }

    async createPayment(dto: CreatePaymentDto, userId: number, ipAddr: string) {
        // Kiểm tra post có tồn tại và thuộc về user
        const post = await this.prisma.post.findFirst({
            where: { id: dto.postId, userId },
        });

        if (!post) {
            throw new NotFoundException('Post not found or you do not own this post');
        }

        // Kiểm tra gói VIP có tồn tại
        const vipPackage = await this.prisma.vipPackage.findUnique({
            where: { id: dto.packageId },
        });

        if (!vipPackage || vipPackage.status !== 1) {
            throw new NotFoundException('VIP package not found or inactive');
        }

        // Tạo subscription
        const subscription = await this.prisma.vipSubscription.create({
            data: {
                postId: dto.postId,
                packageId: dto.packageId,
                userId: userId,
                status: 0, // pending payment
            },
        });

        // Tạo payment record
        const payment = await this.prisma.payment.create({
            data: {
                subscriptionId: subscription.id,
                userId: userId,
                amount: vipPackage.price,
                paymentMethod: dto.paymentMethod,
                status: 0, // pending
            },
        });

        // Tạo payment URL dựa trên payment method
        let paymentUrl: string;
        const orderId = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const orderInfo = `Thanh toan goi VIP cho tin dang`;

        if (dto.paymentMethod === 'vnpay') {
            // Không dùng dto.returnUrl cho VNPay - luôn dùng VNPAY_RETURN_URL từ env
            // để VNPay callback về backend xác thực và cập nhật DB trước khi redirect về frontend
            paymentUrl = this.vnpayService.createPaymentUrl(
                orderId,
                Number(vipPackage.price),
                orderInfo,
                ipAddr,
            );
        } else if (dto.paymentMethod === 'momo') {
            const momoResponse = await this.momoService.createPaymentUrl(
                orderId,
                Number(vipPackage.price),
                orderInfo,
                dto.returnUrl,
            );
            paymentUrl = momoResponse.payUrl;
        } else {
            throw new BadRequestException('Invalid payment method');
        }

        // Cập nhật payment với URL và transaction ID
        await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
                paymentUrl,
                transactionId: orderId,
            },
        });

        // Log transaction
        await this.prisma.paymentTransaction.create({
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
                paymentId: payment.id,
                subscriptionId: subscription.id,
                paymentUrl,
                amount: vipPackage.price,
            },
        };
    }

    async handleVNPayCallback(vnp_Params: any) {
        console.log('==================== VNPay CALLBACK RECEIVED ====================');
        console.log('Raw vnp_Params:', JSON.stringify(vnp_Params, null, 2));

        const verification = this.vnpayService.verifyReturnUrl(vnp_Params);
        console.log('Verification result:', verification);

        const transactionId = vnp_Params.vnp_TxnRef;
        const responseCode = vnp_Params.vnp_ResponseCode;

        console.log('Transaction ID:', transactionId);
        console.log('Response Code:', responseCode);

        // Tìm payment
        const payment = await this.prisma.payment.findUnique({
            where: { transactionId },
            include: {
                subscription: {
                    include: {
                        package: true,
                        post: { select: { title: true } },
                    },
                },
                user: { select: { fullName: true, email: true } },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Cập nhật transaction log
        await this.prisma.paymentTransaction.updateMany({
            where: { transactionId },
            data: {
                status: verification.isValid && responseCode === '00' ? 'success' : 'failed',
                responseCode: responseCode,
                responseData: JSON.stringify(vnp_Params),
            },
        });

        if (verification.isValid && responseCode === '00') {
            // Thanh toán thành công
            await this.activateSubscription(payment.id, payment.subscription);
            this.sendPaymentNotification(payment, true);
            return { success: true, message: 'Payment successful' };
        } else {
            // Thanh toán thất bại
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: 2 }, // failed
            });

            await this.prisma.vipSubscription.update({
                where: { id: payment.subscriptionId },
                data: { status: 3 }, // cancelled
            });

            this.sendPaymentNotification(payment, false);

            return { success: false, message: 'Payment failed' };
        }
    }

    async handleMoMoCallback(momoData: any) {
        const isValid = this.momoService.verifySignature(momoData);

        const transactionId = momoData.orderId;
        const resultCode = momoData.resultCode;

        // Tìm payment
        const payment = await this.prisma.payment.findUnique({
            where: { transactionId },
            include: {
                subscription: {
                    include: {
                        package: true,
                        post: { select: { title: true } },
                    },
                },
                user: { select: { fullName: true, email: true } },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Cập nhật transaction log
        await this.prisma.paymentTransaction.updateMany({
            where: { transactionId },
            data: {
                status: isValid && resultCode === 0 ? 'success' : 'failed',
                responseCode: String(resultCode),
                responseData: JSON.stringify(momoData),
            },
        });

        if (isValid && resultCode === 0) {
            // Thanh toán thành công
            await this.activateSubscription(payment.id, payment.subscription);
            this.sendPaymentNotification(payment, true);
            return { success: true, message: 'Payment successful' };
        } else {
            // Thanh toán thất bại
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: 2 }, // failed
            });

            await this.prisma.vipSubscription.update({
                where: { id: payment.subscriptionId },
                data: { status: 3 }, // cancelled
            });

            this.sendPaymentNotification(payment, false);

            return { success: false, message: 'Payment failed' };
        }
    }

    private async activateSubscription(paymentId: number, subscription: any) {
        const now = new Date();

        // Lấy thông tin package để tính endDate
        const vipPackage = await this.prisma.vipPackage.findUnique({
            where: { id: subscription.packageId },
        });

        if (!vipPackage) {
            throw new NotFoundException('VIP package not found');
        }

        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + vipPackage.durationDays);

        // Cập nhật payment
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 1, // success
                paidAt: now,
            },
        });

        // Kích hoạt subscription
        await this.prisma.vipSubscription.update({
            where: { id: subscription.id },
            data: {
                status: 1, // active
                startDate: now,
                endDate: endDate,
            },
        });

        // Cập nhật post VIP status
        await this.prisma.post.update({
            where: { id: subscription.postId },
            data: {
                isVip: true,
                vipExpiry: endDate,
                postedAt: now, // Cập nhật thời gian đăng để đưa lên đầu
            },
        });
    }

    private sendPaymentNotification(payment: any, isSuccess: boolean) {
        if (!payment?.user?.email) return;
        const packageName = payment.subscription?.package?.name || 'Gói VIP';
        const postTitle = payment.subscription?.post?.title;
        const amount = Number(payment.amount || 0);
        const method = payment.paymentMethod;
        const html = isSuccess
            ? this.mailService.getPaymentSuccessEmailHtml(payment.user.fullName || 'Quý khách', amount, packageName, postTitle, method)
            : this.mailService.getPaymentFailureEmailHtml(payment.user.fullName || 'Quý khách', amount, packageName, postTitle, method);

        this.mailProducer.sendMail(
            payment.user.email,
            isSuccess ? 'Thanh toán VIP thành công' : 'Thanh toán VIP thất bại',
            html,
        );
    }

    async getPaymentById(id: number, userId: number) {
        const payment = await this.prisma.payment.findFirst({
            where: { id, userId },
            include: {
                subscription: {
                    include: {
                        package: true,
                        post: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return { data: payment };
    }

    async getMyPayments(userId: number, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const payments = await this.prisma.payment.findMany({
            where: { userId },
            include: {
                subscription: {
                    include: {
                        package: true,
                        post: {
                            select: {
                                id: true,
                                title: true,
                                city: true,
                                district: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        });

        const total = await this.prisma.payment.count({
            where: { userId },
        });

        return {
            data: payments,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==================== MOCK PAYMENT FOR TESTING ====================

    async simulatePaymentSuccess(paymentId: number, userId: number) {
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: paymentId,
                userId: userId,
            },
            include: {
                subscription: {
                    include: {
                        post: true,
                        package: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (payment.status === 1) {
            throw new BadRequestException('Payment already completed');
        }

        // Update payment status
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 1, // PAID
                paidAt: new Date(),
                transactionId: `MOCK_${Date.now()}`,
            },
        });

        // Activate VIP subscription
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + payment.subscription.package.durationDays);

        await this.prisma.vipSubscription.update({
            where: { id: payment.subscription.id },
            data: {
                status: 1, // active
                startDate: new Date(),
                endDate: endDate,
            },
        });

        // Update post to VIP
        await this.prisma.post.update({
            where: { id: payment.subscription.postId },
            data: {
                isVip: true,
                vipExpiry: endDate,
            },
        });

        return {
            success: true,
            message: 'Payment simulated successfully',
            data: {
                paymentId: payment.id,
                postId: payment.subscription.postId,
                packageName: payment.subscription.package.name,
                endDate: endDate,
            },
        };
    }
}
