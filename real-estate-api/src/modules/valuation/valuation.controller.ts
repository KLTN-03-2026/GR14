import { Controller, Post, Body } from '@nestjs/common';
import { ValuationService } from './valuation.service';
import { EstimateValuationDto } from './dto/valuation.dto';

@Controller('valuation')
export class ValuationController {
  constructor(private readonly valuationService: ValuationService) {}

  @Post('estimate')
  estimatePrice(@Body() dto: EstimateValuationDto) {
    return this.valuationService.estimatePrice(dto);
  }
}
