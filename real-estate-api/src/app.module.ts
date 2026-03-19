import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { CustomerModule } from './modules/customer/customer.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { PropertyCategoryModule } from './modules/property-category/property-category.module';
import { HouseModule } from './modules/house/house.module';
import { LandModule } from './modules/land/land.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { PostModule } from './modules/post/post.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { FeaturedModule } from './modules/featured/featured.module';
import { ProfileModule } from './modules/profile/profile.module';
import { VipPackageModule } from './modules/vip-package/vip-package.module';
import { PaymentModule } from './modules/payment/payment.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { MailModule } from './common/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    MailModule,
    AuthModule,
    UserModule,
    RoleModule,
    CustomerModule,
    EmployeeModule,
    PropertyCategoryModule,
    HouseModule,
    LandModule,
    AppointmentModule,
    PostModule,
    FavoriteModule,
    FeaturedModule,
    ProfileModule,
    VipPackageModule,
    PaymentModule,
  ],
})
export class AppModule { }
