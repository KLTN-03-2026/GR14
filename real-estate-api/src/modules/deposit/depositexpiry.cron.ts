import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DepositService } from './deposit.service';

/**
 * DepositExpiryCron
 *
 * Chạy lúc 07:05 sáng giờ Việt Nam (UTC 00:05) mỗi ngày.
 * Quét các giao dịch cọc status=1 đã quá expiresAt → expire + nhả BĐS.
 *
 * [FIX] Bỏ PrismaService — không dùng trực tiếp ở đây,
 * toàn bộ DB access đã được đóng gói trong DepositService.expireDeposit().
 */
@Injectable()
export class DepositExpiryCron {
  private readonly logger = new Logger(DepositExpiryCron.name);

  constructor(private readonly depositService: DepositService) {}

  /**
   * '5 0 * * *' = 00:05 UTC = 07:05 giờ Việt Nam
   *
   * Không dùng CronExpression.EVERY_DAY_AT_1AM vì đó là 01:00 UTC (08:00 VN),
   * muốn chạy sát đầu ngày VN thì '5 0 * * *' chính xác hơn.
   */
  @Cron('5 0 * * *')
  async handleDepositExpiry(): Promise<void> {
    const now = new Date();
    this.logger.log(
      `[DepositExpiryCron] Bắt đầu kiểm tra cọc hết hạn lúc ${now.toISOString()}`,
    );

    // [FIX] Query trực tiếp từ DepositService thay vì inject PrismaService riêng
    const expiredIds = await this.depositService.findExpiredDepositIds(now);

    if (expiredIds.length === 0) {
      this.logger.log('[DepositExpiryCron] Không có giao dịch cọc nào hết hạn');
      return;
    }

    this.logger.log(
      `[DepositExpiryCron] Tìm thấy ${expiredIds.length} giao dịch hết hạn, đang xử lý...`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const id of expiredIds) {
      try {
        await this.depositService.expireDeposit(id);
        successCount++;
        this.logger.debug(`[DepositExpiryCron] Đã xử lý deposit #${id}`);
      } catch (error) {
        failCount++;
        this.logger.warn(
          `[DepositExpiryCron] Lỗi deposit #${id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `[DepositExpiryCron] Hoàn tất: ${successCount} thành công, ${failCount} lỗi`,
    );
  }
}