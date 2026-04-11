import { Module } from '@nestjs/common';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [CloudinaryModule, RedisModule, AiModule],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
