import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
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
 */
@Controller()
export class MailConsumerController {
  private readonly logger = new Logger(MailConsumerController.name);

  constructor(private readonly mailService: MailService) {}

  @EventPattern('mail.send')
  async handleSendMail(@Payload() data: SendMailPayload): Promise<void> {
    this.logger.log(
      `[RabbitMQ] Nhận job gửi mail → ${data.to} | Tiêu đề: "${data.subject}"`,
    );
    try {
      await this.mailService.sendEmail(data.to, data.subject, data.html);
      this.logger.log(`[RabbitMQ] Gửi mail thành công → ${data.to}`);
    } catch (err) {
      this.logger.error(`[RabbitMQ] Gửi mail thất bại → ${data.to}`, err);
      // Nếu throw ở đây, RabbitMQ sẽ nack và có thể retry (tuỳ config)
      throw err;
    }
  }
}
