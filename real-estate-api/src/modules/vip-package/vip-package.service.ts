import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateVipPackageDto,
  UpdateVipPackageDto,
} from './dto/vip-package.dto';

type FeatureFlags = {
  highlight: boolean;
  topPost: boolean;
  featured: boolean;
  urgent: boolean;
  badge: string;
};

const VIP_TIER_RULES: Record<
  number,
  { durationDays: number; badge: string; features: Omit<FeatureFlags, 'badge'> }
> = {
  1: {
    durationDays: 3,
    badge: 'VIP Basic',
    features: {
      highlight: true,
      topPost: false,
      featured: false,
      urgent: false,
    },
  },
  2: {
    durationDays: 7,
    badge: 'VIP Standard',
    features: {
      highlight: true,
      topPost: false,
      featured: true,
      urgent: false,
    },
  },
  3: {
    durationDays: 15,
    badge: 'VIP Pro',
    features: { highlight: true, topPost: true, featured: true, urgent: false },
  },
  4: {
    durationDays: 30,
    badge: 'VIP Premium',
    features: { highlight: true, topPost: true, featured: true, urgent: true },
  },
};

@Injectable()
export class VipPackageService {
  constructor(private prisma: PrismaService) {}

  private parseFeatures(raw?: string | null): FeatureFlags {
    if (!raw?.trim()) {
      return {
        highlight: false,
        topPost: false,
        featured: false,
        urgent: false,
        badge: '',
      };
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        highlight: parsed.highlight === true,
        topPost: parsed.topPost === true,
        featured: parsed.featured === true,
        urgent: parsed.urgent === true,
        badge: typeof parsed.badge === 'string' ? parsed.badge.trim() : '',
      };
    } catch {
      return {
        highlight: false,
        topPost: false,
        featured: false,
        urgent: false,
        badge: '',
      };
    }
  }

  private buildFeatureSignature(
    durationDays: number,
    features: FeatureFlags,
  ): string {
    return [
      durationDays,
      features.highlight ? 1 : 0,
      features.topPost ? 1 : 0,
      features.featured ? 1 : 0,
      features.urgent ? 1 : 0,
      features.badge,
    ].join('|');
  }

  private normalizeFeatures(raw?: string): string | null | undefined {
    if (raw === undefined) return undefined;

    const input = raw.trim();
    if (!input) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new BadRequestException('Tính năng không đúng định dạng');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('Tính năng phải là object JSON hợp lệ');
    }

    const obj = parsed as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    const booleanKeys = ['highlight', 'topPost', 'featured', 'urgent'] as const;

    for (const key of booleanKeys) {
      if (obj[key] === undefined) continue;
      if (typeof obj[key] !== 'boolean') {
        throw new BadRequestException(`Tính năng ${key} phải là true/false`);
      }
      normalized[key] = obj[key];
    }

    if (obj.badge !== undefined) {
      if (typeof obj.badge !== 'string') {
        throw new BadRequestException('Badge phải là chuỗi ký tự');
      }

      const badge = obj.badge.trim();
      if (badge.length > 30) {
        throw new BadRequestException('Badge tối đa 30 ký tự');
      }

      if (badge && !/^(?=.{1,30}$)[\p{L}\p{N}\s-]+$/u.test(badge)) {
        throw new BadRequestException(
          'Badge chỉ cho phép chữ, số, khoảng trắng và dấu gạch ngang',
        );
      }

      if (badge) normalized.badge = badge;
    }

    return Object.keys(normalized).length ? JSON.stringify(normalized) : null;
  }

  private async ensureUniqueActivePriority(
    packageType: string,
    priorityLevel: number,
    excludeId?: number,
  ) {
    const existed = await this.prisma.vipPackage.findFirst({
      where: {
        packageType,
        priorityLevel,
        status: 1,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existed) {
      throw new BadRequestException(
        'Mức độ ưu tiên đã tồn tại, vui lòng chọn mức khác',
      );
    }
  }

  private async enforceTierRules(input: {
    id?: number;
    status: number;
    durationDays: number;
    priorityLevel: number;
    price: number;
    features?: string | null;
    packageType: string;
  }) {
    if (input.status !== 1) return;

    if (!VIP_TIER_RULES[input.priorityLevel]) {
      throw new BadRequestException(
        'Chỉ cho phép mức ưu tiên từ 1 đến 4 theo bộ gói VIP chuẩn',
      );
    }

    const tier = VIP_TIER_RULES[input.priorityLevel];
    const flags = this.parseFeatures(input.features);

    if (input.durationDays !== tier.durationDays) {
      throw new BadRequestException(
        `Mức ưu tiên ${input.priorityLevel} phải có thời hạn ${tier.durationDays} ngày`,
      );
    }

    if (flags.badge !== tier.badge) {
      throw new BadRequestException(
        `Mức ưu tiên ${input.priorityLevel} phải dùng badge ${tier.badge}`,
      );
    }

    if (
      flags.highlight !== tier.features.highlight ||
      flags.topPost !== tier.features.topPost ||
      flags.featured !== tier.features.featured ||
      flags.urgent !== tier.features.urgent
    ) {
      throw new BadRequestException(
        'Tính năng gói không đúng mẫu phân tầng đã quy định',
      );
    }

    const activePackages = await this.prisma.vipPackage.findMany({
      where: {
        status: 1,
        packageType: input.packageType,
        ...(input.id ? { id: { not: input.id } } : {}),
      },
      select: {
        id: true,
        durationDays: true,
        priorityLevel: true,
        price: true,
        features: true,
      },
    });

    const currentSignature = this.buildFeatureSignature(
      input.durationDays,
      flags,
    );
    const duplicateByDurationAndFeature = activePackages.find((pkg) => {
      const pkgSignature = this.buildFeatureSignature(
        pkg.durationDays,
        this.parseFeatures(pkg.features),
      );
      return pkgSignature === currentSignature;
    });

    if (duplicateByDurationAndFeature) {
      throw new BadRequestException(
        'Đã tồn tại gói active có cùng thời hạn và bộ tính năng',
      );
    }

    const allForPriceCheck = [
      ...activePackages.map((pkg) => ({
        priorityLevel: pkg.priorityLevel,
        price: Number(pkg.price),
      })),
      {
        priorityLevel: input.priorityLevel,
        price: Number(input.price),
      },
    ].sort((a, b) => a.priorityLevel - b.priorityLevel);

    for (let i = 1; i < allForPriceCheck.length; i += 1) {
      if (allForPriceCheck[i].price <= allForPriceCheck[i - 1].price) {
        throw new BadRequestException(
          'Giá gói cao hơn phải lớn hơn giá gói có mức ưu tiên thấp hơn',
        );
      }
    }
  }

  // ==================== VIP PACKAGE MANAGEMENT ====================

  async createPackage(dto: CreateVipPackageDto) {
    const nextStatus = dto.status ?? 1;
    const pType = dto.packageType || 'POST_VIP';

    if (nextStatus === 1) {
      await this.ensureUniqueActivePriority(pType, dto.priorityLevel);
    }

    const normalizedFeatures = this.normalizeFeatures(dto.features);
    await this.enforceTierRules({
      status: nextStatus,
      durationDays: dto.durationDays,
      priorityLevel: dto.priorityLevel,
      price: dto.price,
      features: normalizedFeatures,
      packageType: pType,
    });

    const vipPackage = await this.prisma.vipPackage.create({
      data: {
        name: dto.name,
        description: dto.description,
        durationDays: dto.durationDays,
        price: dto.price,
        priorityLevel: dto.priorityLevel,
        features: normalizedFeatures,
        status: nextStatus,
        packageType: pType,
      },
    });

    return {
      message: 'VIP package created successfully',
      data: vipPackage,
    };
  }

  async getAllPackages(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const packages = await this.prisma.vipPackage.findMany({
      where: { status: 1 },
      orderBy: { priorityLevel: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.vipPackage.count({
      where: { status: 1 },
    });

    return {
      data: packages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPackageById(id: number) {
    const vipPackage = await this.prisma.vipPackage.findUnique({
      where: { id },
    });

    if (!vipPackage) {
      throw new NotFoundException('VIP package not found');
    }

    return { data: vipPackage };
  }

  async updatePackage(id: number, dto: UpdateVipPackageDto) {
    const vipPackage = await this.prisma.vipPackage.findUnique({
      where: { id },
    });

    if (!vipPackage) {
      throw new NotFoundException('VIP package not found');
    }

    const nextPriorityLevel = dto.priorityLevel ?? vipPackage.priorityLevel;
    const nextStatus = dto.status ?? vipPackage.status;
    const nextPackageType = dto.packageType ?? vipPackage.packageType;

    if (nextStatus === 1) {
      await this.ensureUniqueActivePriority(nextPackageType, nextPriorityLevel, id);
    }

    const normalizedFeatures = this.normalizeFeatures(dto.features);
    await this.enforceTierRules({
      id,
      status: nextStatus,
      durationDays: dto.durationDays ?? vipPackage.durationDays,
      priorityLevel: nextPriorityLevel,
      price: dto.price ?? Number(vipPackage.price),
      features:
        normalizedFeatures !== undefined
          ? normalizedFeatures
          : vipPackage.features,
      packageType: nextPackageType,
    });

    const updated = await this.prisma.vipPackage.update({
      where: { id },
      data: {
        ...dto,
        ...(normalizedFeatures !== undefined
          ? { features: normalizedFeatures }
          : {}),
      },
    });

    return {
      message: 'VIP package updated successfully',
      data: updated,
    };
  }

  async deletePackage(id: number) {
    const vipPackage = await this.prisma.vipPackage.findUnique({
      where: { id },
    });

    if (!vipPackage) {
      throw new NotFoundException('VIP package not found');
    }

    // Soft delete
    await this.prisma.vipPackage.update({
      where: { id },
      data: { status: 0 },
    });

    return { message: 'VIP package deleted successfully' };
  }

  // ==================== VIP SUBSCRIPTION ====================

  async getMySubscriptions(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const subscriptions = await this.prisma.vipSubscription.findMany({
      where: { userId },
      include: {
        package: true,
        post: {
          select: {
            id: true,
            title: true,
            city: true,
            district: true,
            status: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            paidAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.vipSubscription.count({
      where: { userId },
    });

    return {
      data: subscriptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSubscriptionById(id: number, userId: number) {
    const subscription = await this.prisma.vipSubscription.findFirst({
      where: { id, userId },
      include: {
        package: true,
        post: true,
        payment: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return { data: subscription };
  }

  async cancelSubscription(id: number, userId: number) {
    const subscription = await this.prisma.vipSubscription.findFirst({
      where: { id, userId },
      include: { payment: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === 1) {
      throw new BadRequestException('Cannot cancel active subscription');
    }

    if (subscription.payment && subscription.payment.status === 1) {
      throw new BadRequestException('Cannot cancel paid subscription');
    }

    await this.prisma.vipSubscription.update({
      where: { id },
      data: { status: 3 }, // cancelled
    });

    return { message: 'Subscription cancelled successfully' };
  }

  // ==================== ADMIN ====================

  async getAllSubscriptions(page = 1, limit = 10, status?: number) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status !== undefined) {
      where.status = status;
    }

    const subscriptions = await this.prisma.vipSubscription.findMany({
      where,
      include: {
        package: true,
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            city: true,
            district: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.vipSubscription.count({ where });

    return {
      data: subscriptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
