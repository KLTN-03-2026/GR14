import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

/**
 * MailProducerService
 *
 * Thay vì gọi nodemailer trực tiếp, service này chỉ làm một việc:
 * PUBLISH một message lên RabbitMQ queue "mail_queue".
 *
 * Flow:
 *  AppointmentService / AuthService
 *       |
 *       | this.mailProducer.sendMail(to, subject, html)
 *       ↓
 *  RabbitMQ [mail_queue]
 *       |
 *       | event: 'mail.send'
 *       ↓
 *  MailConsumerController.handleSendMail()
 *       |
 *       | MailService.sendEmail()  (nodemailer – gửi thật)
 *       ↓
 *  Gmail SMTP
 */
@Injectable()
export class MailProducerService {
  constructor(
    // 'MAIL_SERVICE' là token đăng ký trong ClientsModule (mail.module.ts)
    @Inject('MAIL_SERVICE') private readonly client: ClientProxy,
  ) {}

  /**
   * Đẩy job gửi mail vào queue – NON-BLOCKING (fire-and-forget).
   * Request hiện tại không phải chờ SMTP phản hồi.
   */
  sendMail(to: string, subject: string, html: string): void {
    this.client.emit<void>('mail.send', { to, subject, html });
  }
}
