import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

/**
 * Unit tests for AuthService — tests core login and register logic.
 * Uses mocked PrismaService, JwtService, ConfigService, and MailProducerService.
 */
describe('AuthService', () => {
  let authService: AuthService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
      },
      passwordReset: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      role: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn() },
      customer: { create: jest.fn() },
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const map: Record<string, string> = {
          JWT_REFRESH_SECRET: 'test-secret',
          JWT_REFRESH_EXPIRES: '7d',
          MAX_REFRESH_TOKENS_PER_USER: '5',
          GOOGLE_CLIENT_ID: 'test-google-id',
        };
        return map[key] || defaultValue;
      }),
    };
    const mailProducer = { sendMail: jest.fn() };
    const mailService = {
      getOtpRegisterEmailHtml: jest.fn().mockReturnValue('<p>OTP</p>'),
      getOtpResetPasswordEmailHtml: jest.fn().mockReturnValue('<p>OTP</p>'),
    };

    authService = new AuthService(
      prisma,
      jwtService as any,
      configService as any,
      mailProducer as any,
      mailService as any,
    );
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'nouser', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: hash,
      });

      await expect(
        authService.login({ username: 'admin', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user + tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('admin123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        password: hash,
        fullName: 'Admin',
        phone: '0123456789',
        address: null,
        isVip: false,
        vipExpiry: null,
      });
      prisma.userRole.findMany.mockResolvedValue([
        { role: { code: 'ADMIN' } },
      ]);

      const result = await authService.login({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.username).toBe('admin');
      expect(result.user.roles).toEqual(['ADMIN']);
    });
  });

  describe('register', () => {
    it('should throw if username already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        authService.register({
          username: 'existing',
          password: '123',
          email: 'a@b.com',
          fullName: 'Test',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send OTP email and return tempData on valid register', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.register({
        username: 'newuser',
        password: 'pass123',
        email: 'new@test.com',
        fullName: 'New User',
        phone: null,
        address: null,
      } as any);

      expect(result.message).toContain('OTP');
      expect(result.tempData.username).toBe('newuser');
    });
  });
});
