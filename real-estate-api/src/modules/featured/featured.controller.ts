import { Controller, Get, Query } from '@nestjs/common';
import { FeaturedService } from './featured.service';

@Controller('featured')
export class FeaturedController {
    constructor(private readonly featuredService: FeaturedService) { }

    @Get()
    getFeatured(@Query('limit') limit = 8) {
        return this.featuredService.getFeaturedProperties(+limit);
    }

    @Get('houses')
    getFeaturedHouses(@Query('limit') limit = 8) {
        return this.featuredService.getFeaturedHouses(+limit);
    }

    @Get('lands')
    getFeaturedLands(@Query('limit') limit = 8) {
        return this.featuredService.getFeaturedLands(+limit);
    }

    @Get('posts')
    getFeaturedPosts(@Query('limit') limit = 4) {
        return this.featuredService.getFeaturedPosts(+limit);
    }
}
