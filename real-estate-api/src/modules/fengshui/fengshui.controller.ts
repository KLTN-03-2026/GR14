import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FengshuiService } from './fengshui.service';
import { FengshuiAnalyzeDto } from './dto/fengshui.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fengshui')
@UseGuards(JwtAuthGuard)
export class FengshuiController {
  constructor(private readonly fengshuiService: FengshuiService) {}

  @Post('analyze')
  async analyze(@Body() dto: FengshuiAnalyzeDto, @Request() req: any) {
    return this.fengshuiService.analyze(dto, req.user);
  }
}
