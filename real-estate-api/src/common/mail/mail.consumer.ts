import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { MailService } from './mail.service';

interface SendMailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * MailConsumerController
 *
 * Đây là "worker" phía consumer.
 * Nó lắng nghe queue RabbitMQ và gọi MailService thực sự khi có message đến.
 *
 * @EventPattern('mail.send') – khớp với tên event mà MailProducerService emit.
 *
 * Cải tiến:
 * - Retry 3 lần trước khi bỏ qua message
 * - Luôn acknowledge message để tránh block queue
 * - Log chi tiết lỗi cho debugging trên VPS
 */
@Controller()
export class MailConsumerController {
  private readonly logger = new Logger(MailConsumerController.name);

  constructor(private readonly mailService: MailService) {}

  @EventPattern('mail.send')
  async handleSendMail(
    @Payload() data: SendMailPayload,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    this.logger.log(
      `[RabbitMQ] Nhận job gửi mail → ${data.to} | Tiêu đề: "${data.subject}"`,
    );

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.mailService.sendEmail(data.to, data.subject, data.html);
        this.logger.log(`[RabbitMQ] ✅ Gửi mail thành công → ${data.to} (lần ${attempt})`);

        // Acknowledge message sau khi gửi thành công
        this.ackMessage(context);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `[RabbitMQ] ⚠️ Gửi mail thất bại lần ${attempt}/${MAX_RETRIES} → ${data.to}: ${lastError.message}`,
        );

        // Chờ trước khi retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
          const delayMs = attempt * 2000; // 2s, 4s
          await this.delay(delayMs);
        }
      }
    }

    // Sau MAX_RETRIES vẫn fail → log error và ACKNOWLEDGE (để không block queue)
    this.logger.error(
      `[RabbitMQ] ❌ Gửi mail thất bại sau ${MAX_RETRIES} lần → ${data.to} | Subject: "${data.subject}" | Error: ${lastError?.message}`,
      lastError?.stack,
    );

    // Luôn ack message để queue không bị stuck
    this.ackMessage(context);
  }

  /**
   * Safely acknowledge message — chống lỗi double-ack hoặc missing channel
   */
  private ackMessage(context: RmqContext): void {
    try {
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      if (channel && originalMsg) {
        channel.ack(originalMsg);
      }
    } catch (err) {
      this.logger.warn(`[RabbitMQ] Không thể ack message: ${err}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
