import { Module } from '@nestjs/common';
import { LandService } from './land.service';
import { LandController } from './land.controller';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
    imports: [CloudinaryModule, RedisModule],
    controllers: [LandController],
    providers: [LandService],
    exports: [LandService],
})
export class LandModule { }
