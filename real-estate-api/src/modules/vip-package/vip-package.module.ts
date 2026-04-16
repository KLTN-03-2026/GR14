import { Module } from '@nestjs/common';
import { VipPackageController } from './vip-package.controller';
import { VipPackageService } from './vip-package.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VipPackageController],
  providers: [VipPackageService],
  exports: [VipPackageService],
})
export class VipPackageModule {}
