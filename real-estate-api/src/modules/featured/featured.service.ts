import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeaturedService {
  constructor(private prisma: PrismaService) {}

  private isVipSchemaMismatchError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2021' || error.code === 'P2022';
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('vipsubscriptions') || msg.includes('vip_subscriptions')
      );
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('vipsubscriptions') || msg.includes('vip_subscriptions')
      );
    }

    return false;
  }

  async getFeaturedHouses(limit = 8) {
    // Get houses with most appointments
    const houses = await this.prisma.house.findMany({
      where: { status: 1 },
      include: {
        images: { select: { url: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { appointments: { _count: 'desc' } },
      take: limit,
    });

    return houses;
  }

  async getFeaturedLands(limit = 8) {
    const lands = await this.prisma.land.findMany({
      where: { status: 1 },
      include: {
        images: { select: { url: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { appointments: { _count: 'desc' } },
      take: limit,
    });

    return lands;
  }

  async getFeaturedPosts(limit = 4) {
    const now = new Date();

    try {
      const posts = await this.prisma.post.findMany({
        where: {
          status: 2,
          vipSubscriptions: {
            some: {
              status: 1,
              endDate: { gte: now },
            },
          },
        },
        include: {
          images: {
            select: { id: true, url: true, position: true },
            orderBy: { position: 'asc' },
          },
          user: {
            select: { id: true, username: true, fullName: true, phone: true },
          },
        },
        orderBy: { postedAt: 'desc' },
        take: limit,
      });

      return posts;
    } catch (error) {
      if (!this.isVipSchemaMismatchError(error)) {
        throw error;
      }

      return this.prisma.post.findMany({
        where: {
          status: 2,
          isVip: true,
        },
        include: {
          images: {
            select: { id: true, url: true, position: true },
            orderBy: { position: 'asc' },
          },
          user: {
            select: { id: true, username: true, fullName: true, phone: true },
          },
        },
        orderBy: { postedAt: 'desc' },
        take: limit,
      });
    }
  }

  async getFeaturedProperties(limit = 8) {
    const [houses, lands, posts] = await Promise.all([
      this.getFeaturedHouses(limit),
      this.getFeaturedLands(limit),
      this.getFeaturedPosts(Math.min(limit, 6)),
    ]);

    return { houses, lands, posts };
  }
}
