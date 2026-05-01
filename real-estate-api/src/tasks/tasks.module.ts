import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { VipExpiryTask } from './vip-expiry.task';
import { DepositExpiryCron } from '../modules/deposit/depositexpiry.cron';
import { DepositModule } from '../modules/deposit/deposit.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, DepositModule],
  providers: [VipExpiryTask, DepositExpiryCron],
})
export class TasksModule {}
