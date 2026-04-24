import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { VipExpiryTask } from './vip-expiry.task';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [VipExpiryTask],
})
export class TasksModule {}
