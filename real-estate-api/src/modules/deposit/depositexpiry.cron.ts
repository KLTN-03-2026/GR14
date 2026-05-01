import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DepositService } from './deposit.service';

/**
 * DepositExpiryCron
 *
 * Chạy lúc 07:05 sáng giờ Việt Nam (UTC 00:05) mỗi ngày.
 * 1. Quét các giao dịch cọc status=1 đã quá expiresAt → expire + nhả BĐS.
 * 2. Fix #2: Cleanup deposit status=0 (pending) quá 30 phút → xoá record.
 */
@Injectable()
export class DepositExpiryCron {
  private readonly logger = new Logger(DepositExpiryCron.name);

  constructor(private readonly depositService: DepositService) {}

  /**
   * '5 0 * * *' = 00:05 UTC = 07:05 giờ Việt Nam
   */
  @Cron('5 0 * * *')
  async handleDepositExpiry(): Promise<void> {
    const now = new Date();
    this.logger.log(
      `[DepositExpiryCron] Bắt đầu kiểm tra cọc hết hạn lúc ${now.toISOString()}`,
    );

    // ── 1. Expire các deposit đang giữ chỗ đã hết hạn ──────────────────────
    const expiredIds = await this.depositService.findExpiredDepositIds(now);

    if (expiredIds.length === 0) {
      this.logger.log('[DepositExpiryCron] Không có giao dịch cọc nào hết hạn');
    } else {
      this.logger.log(
        `[DepositExpiryCron] Tìm thấy ${expiredIds.length} giao dịch hết hạn, đang xử lý...`,
      );

      let successCount = 0;
      let failCount = 0;

      for (const id of expiredIds) {
        try {
          await this.depositService.expireDeposit(id);
          successCount++;
          this.logger.debug(`[DepositExpiryCron] Đã expire deposit #${id}`);
        } catch (error) {
          failCount++;
          this.logger.warn(
            `[DepositExpiryCron] Lỗi expire deposit #${id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      this.logger.log(
        `[DepositExpiryCron] Expire: ${successCount} thành công, ${failCount} lỗi`,
      );
    }

    // ── 2. Fix #2: Cleanup deposit pending quá 30 phút ──────────────────────
    const staleIds = await this.depositService.findStalePendingDepositIds(now);

    if (staleIds.length === 0) {
      this.logger.log('[DepositExpiryCron] Không có deposit pending nào cần cleanup');
    } else {
      this.logger.log(
        `[DepositExpiryCron] Tìm thấy ${staleIds.length} deposit pending cũ, đang cleanup...`,
      );

      let cleanedCount = 0;
      let cleanFailCount = 0;

      for (const id of staleIds) {
        try {
          await this.depositService.cleanupStalePendingDeposit(id);
          cleanedCount++;
          this.logger.debug(`[DepositExpiryCron] Đã cleanup deposit #${id}`);
        } catch (error) {
          cleanFailCount++;
          this.logger.warn(
            `[DepositExpiryCron] Lỗi cleanup deposit #${id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      this.logger.log(
        `[DepositExpiryCron] Cleanup pending: ${cleanedCount} thành công, ${cleanFailCount} lỗi`,
      );
    }
  }
}