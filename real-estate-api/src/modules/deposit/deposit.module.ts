import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { VNPayService } from '../payment/services/vnpay.service';
import { MoMoService } from '../payment/services/momo.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../common/mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, ConfigModule, MailModule, NotificationModule],
  controllers: [DepositController],
  providers: [DepositService, VNPayService, MoMoService],
  exports: [DepositService],
})
export class DepositModule {}