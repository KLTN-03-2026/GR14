import { Module } from '@nestjs/common';
import { FengshuiController } from './fengshui.controller';
import { FengshuiService } from './fengshui.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FengshuiController],
  providers: [FengshuiService],
})
export class FengshuiModule {}
