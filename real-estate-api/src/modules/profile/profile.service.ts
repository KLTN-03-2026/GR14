import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        address: true,
        status: true,
        isVip: true,
        vipExpiry: true,
        createdAt: true,
        userRoles: {
          include: { role: { select: { code: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const activeAccountVip = await this.prisma.vipSubscription.findFirst({
      where: {
        userId,
        postId: null,
        status: 1,
        endDate: { gte: now },
      },
      include: {
        package: {
          select: { name: true, priorityLevel: true, durationDays: true },
        },
      },
      orderBy: [{ package: { priorityLevel: 'desc' } }, { endDate: 'desc' }],
    });

    let resolvedPackage = activeAccountVip?.package || null;

    // Fallback cho dữ liệu cũ: user đã VIP nhưng subscription active bị lệch trạng thái
    if (
      !resolvedPackage &&
      user.isVip &&
      user.vipExpiry &&
      new Date(user.vipExpiry) > now
    ) {
      const latestAccountVip = await this.prisma.vipSubscription.findFirst({
        where: {
          userId,
          postId: null,
        },
        include: {
          package: {
            select: { name: true, priorityLevel: true, durationDays: true },
          },
        },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      });

      resolvedPackage = latestAccountVip?.package || null;
    }

    return {
      ...user,
      vipPackageName: resolvedPackage?.name || null,
      vipPriorityLevel: resolvedPackage?.priorityLevel ?? null,
      vipDurationDays: resolvedPackage?.durationDays ?? null,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        address: true,
      },
    });

    return { message: 'Profile updated successfully', data: updated };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isValid)
      throw new BadRequestException('Current password is incorrect');

    const hashPass = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashPass },
    });

    return { message: 'Password changed successfully' };
  }
}
