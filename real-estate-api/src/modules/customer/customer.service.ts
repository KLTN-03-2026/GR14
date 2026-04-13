import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) { }

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
      if (target.includes('customers_customer_code_key')) {
        throw new BadRequestException('Mã khách hàng đã tồn tại');
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

  private genCode() {
    return `CUS${Math.floor(1000 + Math.random() * 9000)}`;
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { user: true },
      }),
      this.prisma.customer.count(),
    ]);

    return {
      data,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    };
  }

  async findById(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
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

      let user;
      try {
        user = await tx.user.create({
          data: {
            username: normalizedUsername,
            password: await bcrypt.hash(dto.password, 10),
            fullName: dto.fullName,
            phone: normalizedPhone,
            email: normalizedEmail,
            address: dto.address,
            status: 1,
          },
        });
      } catch (error) {
        this.throwFriendlyUniqueError(error);
      }

      const role = await tx.role.findUnique({
        where: { code: 'CUSTOMER' },
      });

      if (role) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }

      let code = this.genCode();
      while (await tx.customer.findUnique({ where: { code } })) {
        code = this.genCode();
      }

      const customer = await tx.customer.create({
        data: { code, userId: user.id },
        include: { user: true },
      });

      return { message: 'Success', data: customer };
    });
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    // Chỉ validate những field được truyền lên
    if (dto.username !== undefined)
      this.ensureNotBlank(dto.username, 'Tên đăng nhập');
    if (dto.password !== undefined)
      this.ensureNotBlank(dto.password, 'Mật khẩu');
    if (dto.phone !== undefined)
      this.ensureNotBlank(dto.phone, 'Số điện thoại');
    if (dto.email !== undefined) this.ensureNotBlank(dto.email, 'Email');

    const normalizedUsername = this.normalizeOptional(dto.username);
    const normalizedEmail = this.normalizeOptional(dto.email);
    const normalizedPhone = this.normalizeOptional(dto.phone);

    // Chỉ check unique nếu có update field này
    if (normalizedUsername || normalizedEmail || normalizedPhone) {
      await this.ensureUniqueUserFields({
        username: normalizedUsername,
        email: normalizedEmail,
        phone: normalizedPhone,
        excludeUserId: customer.userId,
      });
    }

    const data: any = {};
    if (dto.username !== undefined) data.username = normalizedUsername;
    if (dto.email !== undefined) data.email = normalizedEmail;
    if (dto.phone !== undefined) data.phone = normalizedPhone;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.isVip !== undefined) data.isVip = dto.isVip;

    if (dto.password !== undefined) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    try {
      await this.prisma.user.update({
        where: { id: customer.userId },
        data,
      });
    } catch (error) {
      this.throwFriendlyUniqueError(error);
    }

    // Trả về customer data được update
    const updatedCustomer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    return { message: 'Updated', data: updatedCustomer };
  }

  async delete(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // 🔥 update status user
    await this.prisma.user.update({
      where: { id: customer.userId },
      data: { status: 0 },
    });

    return { message: 'Disabled account customer' };
  }
}
