import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { VNPayService } from './services/vnpay.service';
import { MoMoService } from './services/momo.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../../common/mail/mail.module';

@Module({
    imports: [PrismaModule, ConfigModule, MailModule],
    controllers: [PaymentController],
    providers: [PaymentService, VNPayService, MoMoService],
    exports: [PaymentService],
})
export class PaymentModule { }
