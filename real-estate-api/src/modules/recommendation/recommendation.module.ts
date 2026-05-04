import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { ScoringService } from './services/scoring.service';
import { VectorService } from './services/vector.service';
import { UserProfileService } from './services/user-profile.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    ScoringService,
    VectorService,
    UserProfileService,
  ],
  exports: [RecommendationService],
})
export class RecommendationModule {}
