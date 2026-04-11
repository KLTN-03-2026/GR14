import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
