import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiChatCompareService } from './ai-chat-compare.service';
import { DescriptionGeneratorService } from './services';

@Module({
  controllers: [AiController],
  providers: [AiService, AiChatCompareService, DescriptionGeneratorService],
  exports: [AiService],
})
export class AiModule {}
