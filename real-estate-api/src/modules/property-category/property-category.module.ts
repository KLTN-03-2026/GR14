import { Module } from '@nestjs/common';
import { PropertyCategoryService } from './property-category.service';
import { PropertyCategoryController } from './property-category.controller';

@Module({
  controllers: [PropertyCategoryController],
  providers: [PropertyCategoryService],
  exports: [PropertyCategoryService],
})
export class PropertyCategoryModule {}
