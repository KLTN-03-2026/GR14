import { Module } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { FeaturedController } from './featured.controller';

@Module({
  controllers: [FeaturedController],
  providers: [FeaturedService],
  exports: [FeaturedService],
})
export class FeaturedModule {}
