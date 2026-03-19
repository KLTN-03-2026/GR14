import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import ms from 'ms';
import { PrismaService } from '../../prisma/prisma.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { generateOTP } from '../../common/utils/generate-otp';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, ConfirmRegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;
    private maxTokens: number;

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailProducer: MailProducerService, // thay thế MailService trực tiếp
    ) {
        this.googleClient = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
        this.maxTokens = parseInt(this.configService.get('MAX_REFRESH_TOKENS_PER_USER') || '5');
    }

    async login(dto: LoginDto) {
        const { username, password } = dto;

        const user = await this.prisma.user.findUnique({
            where: { username },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid username or password');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new UnauthorizedException('Invalid username or password');
        }

        const userRoles = await this.prisma.userRole.findMany({
            where: { userId: user.id },
            include: { role: { select: { code: true } } },
        });
        const roles = userRoles.map((ur) => ur.role.code);

        let employeeId: number | null = null;
        if (roles.includes('EMPLOYEE')) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (employee) employeeId = employee.id;
        }

        const accessToken = this.jwtService.sign({ id: user.id, username: user.username, roles });

        const refreshToken = this.jwtService.sign(
            { id: user.id },
            {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES') || '7d',
            },
        );

        const refreshExpiresMs = ms((this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d') as ms.StringValue);
        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + refreshExpiresMs),
                revoked: false,
            },
        });

        // Cleanup old tokens
        const allTokens = await this.prisma.refreshToken.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
        if (allTokens.length > this.maxTokens) {
            const idsToDelete = allTokens.slice(this.maxTokens).map((t) => t.id);
            await this.prisma.refreshToken.deleteMany({ where: { id: { in: idsToDelete } } });
        }

        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                address: user.address,
                roles,
                employeeId,
            },
            accessToken,
            refreshToken,
        };
    }

    async refreshToken(refreshToken: string) {
        if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

        const savedToken = await this.prisma.refreshToken.findFirst({
            where: { token: refreshToken, revoked: false },
        });
        if (!savedToken) throw new UnauthorizedException('Invalid refresh token');

        try {
            const decoded = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });

            const userRoles = await this.prisma.userRole.findMany({
                where: { userId: decoded.id },
                include: { role: { select: { code: true } } },
            });
            const roles = userRoles.map((ur) => ur.role.code);

            const newAccessToken = this.jwtService.sign({ id: decoded.id, roles });
            return { accessToken: newAccessToken };
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(refreshToken: string) {
        if (!refreshToken) throw new BadRequestException('Missing refresh token');

        const token = await this.prisma.refreshToken.findFirst({ where: { token: refreshToken } });
        if (token) {
            await this.prisma.refreshToken.update({
                where: { id: token.id },
                data: { revoked: true },
            });
        }
        return { message: 'Logout successful' };
    }

    async register(dto: RegisterDto) {
        const { username, password, fullName, phone, email, address } = dto;

        const existUser = await this.prisma.user.findUnique({ where: { username } });
        if (existUser) throw new BadRequestException('Username already exists');

        if (email) {
            const existEmail = await this.prisma.user.findUnique({ where: { email } });
            if (existEmail) throw new BadRequestException('Email already registered');
        }

        if (phone) {
            const existPhone = await this.prisma.user.findUnique({ where: { phone } });
            if (existPhone) throw new BadRequestException('Phone number already registered');
        }

        const otp = generateOTP();
        const expireAt = new Date(Date.now() + 5 * 60 * 1000);

        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'register' } });
        await this.prisma.passwordReset.create({ data: { email, otp, expireAt, type: 'register' } });

        const html = `
      <p>Hello ${fullName || username},</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code expires in 5 minutes.</p>
    `;
        // Publish lên RabbitMQ – không block request, OTP vẫn được lưu DB rồi
        this.mailProducer.sendMail(email, 'Registration OTP Verification', html);

        return {
            message: 'OTP sent to your email. Please verify to complete registration.',
            tempData: { username, password, fullName, phone, email, address },
        };
    }

    async confirmRegister(dto: ConfirmRegisterDto) {
        const { username, password, fullName, phone, email, address, otp } = dto;

        const record = await this.prisma.passwordReset.findFirst({
            where: { email, otp, type: 'register' },
        });
        if (!record) throw new BadRequestException('Invalid or expired OTP');
        if (record.expireAt < new Date()) {
            await this.prisma.passwordReset.deleteMany({ where: { email, type: 'register' } });
            throw new BadRequestException('OTP has expired');
        }

        const hashPass = await bcrypt.hash(password, 10);
        const newUser = await this.prisma.user.create({
            data: { username, password: hashPass, fullName, phone, email, address, status: 1 },
        });

        const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
        if (customerRole) {
            await this.prisma.userRole.create({ data: { userId: newUser.id, roleId: customerRole.id } });
        }

        await this.prisma.customer.create({
            data: { userId: newUser.id, code: `KH${newUser.id.toString().padStart(3, '0')}` },
        });

        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'register' } });

        return { message: 'Registration successful' };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const { email } = dto;

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new BadRequestException('Email not registered');

        const otp = generateOTP();
        const expireAt = new Date(Date.now() + 5 * 60 * 1000);

        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'reset' } });
        await this.prisma.passwordReset.create({ data: { email, otp, expireAt, type: 'reset' } });

        const html = `
      <p>Hello ${user.fullName || user.username},</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code expires in 5 minutes.</p>
    `;
        // Publish lên RabbitMQ – không block request
        this.mailProducer.sendMail(email, 'Password Reset OTP', html);

        return { message: 'OTP sent to your email' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const { email, otp, newPassword } = dto;

        const record = await this.prisma.passwordReset.findFirst({
            where: { email, otp, type: 'reset' },
        });
        if (!record) throw new BadRequestException('Invalid OTP');
        if (record.expireAt < new Date()) {
            await this.prisma.passwordReset.deleteMany({ where: { email, type: 'reset' } });
            throw new BadRequestException('OTP has expired');
        }

        const hashPass = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { email }, data: { password: hashPass } });
        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'reset' } });

        return { message: 'Password reset successful' };
    }

    async loginGoogle(idToken: string) {
        if (!idToken) throw new BadRequestException('Missing Google ID Token');

        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: this.configService.get('GOOGLE_CLIENT_ID'),
        });
        const payload = ticket.getPayload();
        if (!payload) throw new BadRequestException('Invalid Google token payload');
        const { email, name } = payload;
        if (!email) throw new BadRequestException('Google account has no email');

        let user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            const hashPass = await bcrypt.hash('google_oauth_user', 10);
            user = await this.prisma.user.create({
                data: { username: email, email, password: hashPass, fullName: name || '', status: 1 },
            });
        }

        const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
        if (customerRole) {
            const existedRole = await this.prisma.userRole.findFirst({
                where: { userId: user.id, roleId: customerRole.id },
            });
            if (!existedRole) {
                await this.prisma.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });
            }
        }

        await this.prisma.customer.upsert({
            where: { userId: user.id },
            create: { userId: user.id, code: `KH${user.id.toString().padStart(3, '0')}` },
            update: {},
        });

        const userRoles = await this.prisma.userRole.findMany({
            where: { userId: user.id },
            include: { role: { select: { code: true } } },
        });
        const roles = userRoles.map((ur) => ur.role.code);

        const accessToken = this.jwtService.sign({ id: user.id, username: user.username, roles });
        const refreshToken = this.jwtService.sign(
            { id: user.id },
            {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES') || '7d',
            },
        );

        const refreshExpiresMs = ms((this.configService.get('JWT_REFRESH_EXPIRES') || '7d') as ms.StringValue);
        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + refreshExpiresMs),
                revoked: false,
            },
        });

        return {
            message: 'Login successful',
            accessToken,
            refreshToken,
            roles,
            userId: user.id,
        };
    }
}
