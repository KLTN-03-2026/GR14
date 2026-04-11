import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailProducerService } from './mail-producer.service';
import { MailConsumerController } from './mail.consumer';

/**
 * MailModule
 *
 * Đăng ký ClientsModule để tạo ClientProxy kết nối RabbitMQ.
 * Token 'MAIL_SERVICE' được inject vào MailProducerService.
 *
 * Sơ đồ luồng:
 *  Producer (AppointmentService / AuthService)
 *    → MailProducerService.sendMail()
 *    → [RabbitMQ: mail_queue]
 *    → MailConsumerController.handleSendMail()
 *    → MailService.sendEmail()  (SMTP thật)
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'MAIL_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('RABBITMQ_URL') ||
                'amqp://guest:guest@localhost:5672',
            ],
            queue: 'mail_queue',
            queueOptions: {
              durable: true, // queue tồn tại sau khi RabbitMQ restart
            },
          },
        }),
      },
    ]),
  ],
  controllers: [MailConsumerController],
  providers: [MailService, MailProducerService],
  exports: [MailService, MailProducerService],
})
export class MailModule {}
