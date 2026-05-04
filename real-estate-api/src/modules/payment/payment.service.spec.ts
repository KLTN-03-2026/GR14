import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';

/**
 * Unit tests for PaymentService — tests payment creation and validation logic.
 */
describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      vipPackage: { findUnique: jest.fn() },
      post: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 1, status: 0 }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      vipSubscription: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn(),
      },
      paymentTransaction: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };

    const vnpayService = {
      createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test/pay'),
    };
    const momoService = {
      createPaymentUrl: jest
        .fn()
        .mockResolvedValue({ payUrl: 'https://momo.test/pay' }),
    };
    const mailService = {
      getPaymentSuccessEmailHtml: jest.fn().mockReturnValue('<p></p>'),
      getPaymentFailureEmailHtml: jest.fn().mockReturnValue('<p></p>'),
    };
    const mailProducer = { sendMail: jest.fn() };
    const depositService = { handleDepositSuccess: jest.fn() };

    service = new PaymentService(
      prisma,
      vnpayService as any,
      momoService as any,
      mailService as any,
      mailProducer as any,
      depositService as any,
    );
  });

  describe('createPayment', () => {
    it('should throw NotFoundException if package not found', async () => {
      prisma.vipPackage.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(
          {
            packageId: 999,
            paymentType: 'ACCOUNT_VIP' as any,
            paymentMethod: 'vnpay',
          } as any,
          1,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if package is inactive', async () => {
      prisma.vipPackage.findUnique.mockResolvedValue({
        id: 1,
        status: 0,
        price: 100000,
      });

      await expect(
        service.createPayment(
          {
            packageId: 1,
            paymentType: 'ACCOUNT_VIP' as any,
            paymentMethod: 'vnpay',
          } as any,
          1,
          '127.0.0.1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if paymentType does not match package', async () => {
      prisma.vipPackage.findUnique.mockResolvedValue({
        id: 1,
        status: 1,
        price: 100000,
        packageType: 'ACCOUNT_VIP',
      });

      await expect(
        service.createPayment(
          {
            packageId: 1,
            paymentType: 'POST_VIP' as any,
            paymentMethod: 'vnpay',
          } as any,
          1,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if POST_VIP but no postId provided', async () => {
      prisma.vipPackage.findUnique.mockResolvedValue({
        id: 1,
        status: 1,
        price: 100000,
        packageType: 'POST_VIP',
      });

      await expect(
        service.createPayment(
          {
            packageId: 1,
            paymentType: 'POST_VIP' as any,
            paymentMethod: 'vnpay',
          } as any,
          1,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create VNPay payment and return paymentUrl', async () => {
      prisma.vipPackage.findUnique.mockResolvedValue({
        id: 1,
        status: 1,
        price: 200000,
        packageType: 'ACCOUNT_VIP',
        priorityLevel: 1,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 1, isVip: false });

      const result = await service.createPayment(
        {
          packageId: 1,
          paymentType: 'ACCOUNT_VIP' as any,
          paymentMethod: 'vnpay',
        } as any,
        1,
        '127.0.0.1',
      );

      expect(result.message).toBe('Payment created successfully');
      expect(result.data.paymentUrl).toBe('https://vnpay.test/pay');
      expect(result.data.amount).toBe(200000);
    });
  });
});
