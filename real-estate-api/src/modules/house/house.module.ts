import { Module } from '@nestjs/common';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
    imports: [CloudinaryModule, RedisModule],
    controllers: [HouseController],
    providers: [HouseService],
    exports: [HouseService],
})
export class HouseModule { }
