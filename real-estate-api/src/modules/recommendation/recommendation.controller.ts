/**
 * ==================== CONTROLLER GỢI Ý BĐS ====================
 * Nhận request từ frontend, gọi RecommendationService xử lý, trả kết quả.
 *
 * 4 endpoints:
 *   GET  /recommendations/houses  → Gợi ý nhà cho user
 *   GET  /recommendations/lands   → Gợi ý đất cho user
 *   GET  /recommendations/ai      → Gợi ý AI hybrid (nhà + đất, dùng Qdrant)
 *   POST /recommendations/track   → Ghi lại hành vi user (click/save)
 */
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
import { Throttle } from '@nestjs/throttler';
import { RecommendationService } from './recommendation.service';
import { TrackBehaviorDto } from './dto/track-behavior.dto';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  /**
   * Lấy userId từ JWT token đã decode.
   * Nếu không xác định được → throw lỗi 401 Unauthorized.
   */
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
   * Gợi ý nhà cho user dựa trên hành vi (Rule-based, không dùng AI).
   * - Yêu cầu đăng nhập (JWT)
   * - limit: số BĐS trả về (mặc định 5)
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
   * Gợi ý đất cho user dựa trên hành vi (Rule-based, không dùng AI).
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
   * Gợi ý AI hybrid: kết hợp Embedding (Qdrant) + Rule-based scoring.
   * Đây là endpoint chính, trả về cả nhà lẫn đất xen kẽ.
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
   * Ghi lại hành vi user khi click/save BĐS trên frontend.
   * Body: { action: "click"|"save", houseId?: number, landId?: number }
   *
   * Rate limited: tối đa 60 request/phút/user để chống spam.
   *
   * Sau khi ghi hành vi → xóa cache gợi ý cũ → lần gọi tiếp sẽ tính lại.
   */
  @Post('track')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  trackBehavior(@Req() req: any, @Body() body: TrackBehaviorDto) {
    return this.recommendationService.trackBehavior(
      this.getCurrentUserId(req.user),
      body.action,
      body.houseId,
      body.landId,
    );
  }
}
