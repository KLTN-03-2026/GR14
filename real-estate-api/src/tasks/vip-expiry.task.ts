import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VipExpiryTask {
  private readonly logger = new Logger(VipExpiryTask.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chạy mỗi giờ: hạ cấp VIP cho bài viết, tài khoản và subscription đã hết hạn.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleVipExpiry() {
    const now = new Date();
    this.logger.log(`[VipExpiry] Running at ${now.toISOString()}`);

    try {
      const [postsResult, usersResult, subsResult] = await Promise.all([
        // 1. Hạ VIP bài viết đã hết hạn
        this.prisma.post.updateMany({
          where: {
            isVip: true,
            vipExpiry: { lt: now },
          },
          data: {
            isVip: false,
            vipExpiry: null,
            vipPriorityLevel: 0,
          },
        }),

        // 2. Hạ VIP tài khoản đã hết hạn
        this.prisma.user.updateMany({
          where: {
            isVip: true,
            vipExpiry: { lt: now },
          },
          data: {
            isVip: false,
            vipExpiry: null,
            vipPriorityLevel: 0,
          },
        }),

        // 3. Đánh dấu subscription đã hết endDate sang status = 2 (expired)
        this.prisma.vipSubscription.updateMany({
          where: {
            status: 1,           // đang active
            endDate: { lt: now },
          },
          data: {
            status: 2,           // expired
          },
        }),
      ]);

      this.logger.log(
        `[VipExpiry] Done — posts: ${postsResult.count}, users: ${usersResult.count}, subscriptions: ${subsResult.count}`,
      );
    } catch (err) {
      this.logger.error('[VipExpiry] Failed to run expiry task', err);
    }
  }
}
