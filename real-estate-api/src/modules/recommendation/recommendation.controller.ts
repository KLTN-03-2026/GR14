import {
    Controller, Get, Post, Body, Query, UseGuards, Req,
    ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
    constructor(private readonly recommendationService: RecommendationService) {}

    /**
     * GET /recommendations/houses?limit=5
     * Get personalized house recommendations for authenticated user
     */
    @Get('houses')
    @UseGuards(AuthGuard('jwt'))
    getHouseRecommendations(
        @Req() req: any,
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    ) {
        return this.recommendationService.getHouseRecommendations(req.user.userId, limit);
    }

    /**
     * GET /recommendations/lands?limit=5
     * Get personalized land recommendations for authenticated user
     */
    @Get('lands')
    @UseGuards(AuthGuard('jwt'))
    getLandRecommendations(
        @Req() req: any,
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    ) {
        return this.recommendationService.getLandRecommendations(req.user.userId, limit);
    }

    /**
     * GET /recommendations/ai?limit=10
     * Get hybrid AI recommendations (embedding + rule-based) for authenticated user
     */
    @Get('ai')
    @UseGuards(AuthGuard('jwt'))
    getAIRecommendations(
        @Req() req: any,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.recommendationService.getAIRecommendations(req.user.userId, limit);
    }

    /**
     * POST /recommendations/track
     * Track user behavior for recommendation engine
     */
    @Post('track')
    @UseGuards(AuthGuard('jwt'))
    trackBehavior(
        @Req() req: any,
        @Body() body: { action: string; houseId?: number; landId?: number },
    ) {
        return this.recommendationService.trackBehavior(
            req.user.userId,
            body.action,
            body.houseId,
            body.landId,
        );
    }
}
