import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  private throwFriendlyUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = String(error.meta?.target || '');

      if (target.includes('users_phone_key')) {
        throw new BadRequestException('Số điện thoại đã tồn tại');
      }
      if (target.includes('users_email_key')) {
        throw new BadRequestException('Email đã tồn tại');
      }
      if (target.includes('users_username_key')) {
        throw new BadRequestException('Tên đăng nhập đã tồn tại');
      }

      throw new BadRequestException('Dữ liệu đã tồn tại trong hệ thống');
    }

    throw error;
  }

  private normalizeOptional(value?: string | null) {
    if (typeof value !== 'string') return value ?? undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private ensureNotBlank(value: string | undefined, label: string) {
    if (value !== undefined && value.trim().length === 0) {
      throw new BadRequestException(`${label} không được để trống`);
    }
  }

  private async ensureUniqueUserFields(options: {
    username?: string;
    email?: string;
    phone?: string;
    excludeUserId?: number;
  }) {
    const { username, email, phone, excludeUserId } = options;

    if (username !== undefined) {
      const existedUsername = await this.prisma.user.findUnique({
        where: { username },
      });
      if (existedUsername && existedUsername.id !== excludeUserId) {
        throw new BadRequestException('Tên đăng nhập đã tồn tại');
      }
    }

    if (email !== undefined) {
      const existedEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existedEmail && existedEmail.id !== excludeUserId) {
        throw new BadRequestException('Email đã tồn tại');
      }
    }

    if (phone !== undefined) {
      const existedPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existedPhone && existedPhone.id !== excludeUserId) {
        throw new BadRequestException('Số điện thoại đã tồn tại');
      }
    }
  }

  async checkPhone(phone: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, fullName: true, phone: true, email: true },
    });
    return { exists: !!user, user: user || null };
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          email: true,
          address: true,
          status: true,
          createdAt: true,
          userRoles: {
            include: { role: { select: { code: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    };
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        address: true,
        status: true,
        createdAt: true,
        userRoles: {
          include: { role: { select: { code: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    this.ensureNotBlank(dto.username, 'Tên đăng nhập');
    this.ensureNotBlank(dto.password, 'Mật khẩu');
    this.ensureNotBlank(dto.phone, 'Số điện thoại');
    this.ensureNotBlank(dto.email, 'Email');

    const normalizedUsername = dto.username.trim();
    const normalizedEmail = this.normalizeOptional(dto.email);
    const normalizedPhone = this.normalizeOptional(dto.phone);

    if (!normalizedPhone) {
      throw new BadRequestException('Số điện thoại không được để trống');
    }
    if (!normalizedEmail) {
      throw new BadRequestException('Email không được để trống');
    }

    await this.ensureUniqueUserFields({
      username: normalizedUsername,
      email: normalizedEmail,
      phone: normalizedPhone,
    });

    const hashPass = await bcrypt.hash(dto.password, 10);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          username: normalizedUsername,
          password: hashPass,
          fullName: dto.fullName,
          phone: normalizedPhone,
          email: normalizedEmail,
          address: dto.address,
          status: dto.status ?? 1,
        },
      });
    } catch (error) {
      this.throwFriendlyUniqueError(error);
    }

    if (dto.roleIds?.length) {
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })),
      });
    }

    return { message: 'User created successfully', data: user };
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    this.ensureNotBlank(dto.username, 'Tên đăng nhập');
    this.ensureNotBlank(dto.password, 'Mật khẩu');
    this.ensureNotBlank(dto.phone, 'Số điện thoại');
    this.ensureNotBlank(dto.email, 'Email');

    const normalizedUsername = this.normalizeOptional(dto.username);
    const normalizedEmail = this.normalizeOptional(dto.email);
    const normalizedPhone = this.normalizeOptional(dto.phone);

    await this.ensureUniqueUserFields({
      username: normalizedUsername,
      email: normalizedEmail,
      phone: normalizedPhone,
      excludeUserId: id,
    });

    const data: any = { ...dto };
    delete data.roleIds;

    if (dto.username !== undefined) data.username = normalizedUsername;
    if (dto.email !== undefined) data.email = normalizedEmail;
    if (dto.phone !== undefined) data.phone = normalizedPhone;

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    let updated;
    try {
      updated = await this.prisma.user.update({ where: { id }, data });
    } catch (error) {
      this.throwFriendlyUniqueError(error);
    }
    return { message: 'User updated successfully', data: updated };
  }

  async delete(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (user.status === 0) {
      return { message: 'Tài khoản đã bị khóa trước đó' };
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 0 },
    });

    return { message: 'Đã khóa tài khoản người dùng' };
  }

  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid)
      throw new BadRequestException('Current password is incorrect');

    const hashPass = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashPass },
    });

    return { message: 'Password changed successfully' };
  }
}
