import { Body, Controller, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { IndexDto } from './dto/index.dto';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('chat')
    chat(@Body() dto: ChatDto) {
        return this.aiService.chat(dto);
    }

    @Post('index')
    index(@Query() dto: IndexDto) {
        return this.aiService.indexData(dto.limit ?? 200);
    }
}
