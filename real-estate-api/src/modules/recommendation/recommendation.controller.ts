import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  private getCurrentUserId(user: any): number {
    const userId = user?.id ?? user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'Không xác định được người dùng đăng nhập',
      );
    }
    return userId;
  }

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
    return this.recommendationService.getHouseRecommendations(
      this.getCurrentUserId(req.user),
      limit,
    );
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
    return this.recommendationService.getLandRecommendations(
      this.getCurrentUserId(req.user),
      limit,
    );
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
    return this.recommendationService.getAIRecommendations(
      this.getCurrentUserId(req.user),
      limit,
    );
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
      this.getCurrentUserId(req.user),
      body.action,
      body.houseId,
      body.landId,
    );
  }
}
