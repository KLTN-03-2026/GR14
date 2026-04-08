import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiChatCompareService } from './ai-chat-compare.service';

@Module({
    controllers: [AiController],
    providers: [AiService, AiChatCompareService],
    exports: [AiService],
})
export class AiModule { }
