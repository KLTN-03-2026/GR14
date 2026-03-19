import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import ms from 'ms';
import { PrismaService } from '../../prisma/prisma.service';
import { MailProducerService } from '../../common/mail/mail-producer.service';
import { MailService } from '../../common/mail/mail.service';
import { generateOTP } from '../../common/utils/generate-otp';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, ConfirmRegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;
    private maxTokens: number;
    private tempRegisterStore = new Map<string, RegisterDto>();

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailProducer: MailProducerService,
        private mailService: MailService,
    ) {
        this.googleClient = new OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
        this.maxTokens = parseInt(this.configService.get('MAX_REFRESH_TOKENS_PER_USER') || '5');
    }

    async login(dto: LoginDto) {
        const { username, password } = dto;
        const user = await this.prisma.user.findUnique({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
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
        const refreshToken = this.jwtService.sign({ id: user.id }, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES') || '7d',
        });

        const refreshExpiresMs = ms((this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d') as ms.StringValue);
        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + refreshExpiresMs),
                revoked: false,
            },
        });

        const allTokens = await this.prisma.refreshToken.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
        if (allTokens.length > this.maxTokens) {
            await this.prisma.refreshToken.deleteMany({ where: { id: { in: allTokens.slice(this.maxTokens).map(t => t.id) } } });
        }

        return {
            user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, roles, employeeId },
            accessToken, refreshToken,
        };
    }

    async refreshToken(refreshToken: string) {
        if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
        const savedToken = await this.prisma.refreshToken.findFirst({ where: { token: refreshToken, revoked: false } });
        if (!savedToken) throw new UnauthorizedException('Invalid refresh token');

        try {
            const decoded = this.jwtService.verify(refreshToken, { secret: this.configService.get('JWT_REFRESH_SECRET') });
            const userRoles = await this.prisma.userRole.findMany({
                where: { userId: decoded.id },
                include: { role: { select: { code: true } } },
            });
            return { accessToken: this.jwtService.sign({ id: decoded.id, roles: userRoles.map(ur => ur.role.code) }) };
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(refreshToken: string) {
        const token = await this.prisma.refreshToken.findFirst({ where: { token: refreshToken } });
        if (token) await this.prisma.refreshToken.update({ where: { id: token.id }, data: { revoked: true } });
        return { message: 'Logout successful' };
    }

    async register(dto: RegisterDto) {
        const { username, email, phone, fullName } = dto;
        if (await this.prisma.user.findUnique({ where: { username } })) throw new BadRequestException('Username already exists');
        if (email && await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('Email already registered');
        if (phone && await this.prisma.user.findUnique({ where: { phone } })) throw new BadRequestException('Phone number already registered');

        const otp = generateOTP();
        const expireAt = new Date(Date.now() + 5 * 60 * 1000);
        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'register' } });
        await this.prisma.passwordReset.create({ data: { email, otp, expireAt, type: 'register' } });

        this.tempRegisterStore.set(email, dto);

        const html = this.mailService.getOtpEmailHtml(fullName || username, otp);
        this.mailProducer.sendMail(email, '🔒 Xác Thực OTP - Đăng Ký Tài Khoản', html);

        return { message: 'OTP sent to your email. Please verify to complete registration.', tempData: dto };
    }

    async confirmRegister(dto: ConfirmRegisterDto) {
        const { email, otp } = dto;
        const record = await this.prisma.passwordReset.findFirst({ where: { email, otp, type: 'register' } });
        if (!record || record.expireAt < new Date()) throw new BadRequestException('Invalid or expired OTP');

        const userData = dto.username ? dto : this.tempRegisterStore.get(email);
        if (!userData?.username) throw new BadRequestException('Missing user registration data');

        const hashPass = await bcrypt.hash(userData.password, 10);
        const newUser = await this.prisma.user.create({
            data: { username: userData.username, password: hashPass, fullName: userData.fullName, phone: userData.phone, email, address: userData.address, status: 1 },
        });

        const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
        if (customerRole) await this.prisma.userRole.create({ data: { userId: newUser.id, roleId: customerRole.id } });
        await this.prisma.customer.create({ data: { userId: newUser.id, code: `KH${newUser.id.toString().padStart(3, '0')}` } });

        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'register' } });
        this.tempRegisterStore.delete(email);
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

        const html = this.mailService.getOtpEmailHtml(user.fullName || user.username, otp);
        this.mailProducer.sendMail(email, '🔑 Mã Khôi Phục Mật Khẩu', html);

        return { message: 'OTP sent to your email' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const { email, otp, newPassword } = dto;
        const record = await this.prisma.passwordReset.findFirst({ where: { email, otp, type: 'reset' } });
        if (!record || record.expireAt < new Date()) throw new BadRequestException('Invalid or expired OTP');

        const hashPass = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { email }, data: { password: hashPass } });
        await this.prisma.passwordReset.deleteMany({ where: { email, type: 'reset' } });
        return { message: 'Password reset successful' };
    }

    async loginGoogle(token: string) {
        if (!token) throw new BadRequestException('Missing Google Token');
        let email = '', name = '';

        try {
            const googleRes = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
            email = googleRes.data.email;
            name = googleRes.data.name || '';
        } catch {
            try {
                const ticket = await this.googleClient.verifyIdToken({ idToken: token, audience: this.configService.get('GOOGLE_CLIENT_ID') });
                const payload = ticket.getPayload();
                email = payload?.email ?? '';
                name = payload?.name ?? '';
            } catch {
                throw new BadRequestException('Google authentication failed');
            }
        }

        if (!email) throw new BadRequestException('Google account has no email');

        let user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            const hashPass = await bcrypt.hash('google_oauth_user_' + Math.random(), 10);
            user = await this.prisma.user.create({
                data: { 
                  username: email.split('@')[0] + Math.floor(Math.random() * 1000), 
                  email, 
                  password: hashPass, 
                  fullName: name, 
                  phone: 'G' + Date.now(), 
                  status: 1 
                },
            });
        }

        const customerRole = await this.prisma.role.findUnique({ where: { code: 'CUSTOMER' } });
        if (customerRole) {
            const hasRole = await this.prisma.userRole.findFirst({ where: { userId: user.id, roleId: customerRole.id } });
            if (!hasRole) await this.prisma.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });
        }

        await this.prisma.customer.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, code: `KH${user.id.toString().padStart(3, '0')}` } });

        const userRoles = await this.prisma.userRole.findMany({ where: { userId: user.id }, include: { role: { select: { code: true } } } });
        const roles = userRoles.map(ur => ur.role.code);

        const accessToken = this.jwtService.sign({ id: user.id, username: user.username, roles });
        const refreshToken = this.jwtService.sign({ id: user.id }, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES') || '7d',
        });

        await this.prisma.refreshToken.create({
            data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + ms('7d')), revoked: false },
        });

        return { message: 'Login successful', user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, roles }, accessToken, refreshToken };
    }
}