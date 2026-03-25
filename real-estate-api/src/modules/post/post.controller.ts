import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    Req,
    UseGuards,
    ParseIntPipe,
    UploadedFiles,
    UseInterceptors,
    ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('posts')
export class PostController {
    constructor(private readonly postService: PostService) {}

    @Get('approved')
    findApproved(@Query('page') page = 1, @Query('limit') limit = 6) {
        return this.postService.findApproved(+page, +limit);
    }

    @Get('pending')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    findPending() {
        return this.postService.findPending();
    }

    @Get('all')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    findAll() {
        return this.postService.findAll();
    }

    @Get('my-posts')
    @UseGuards(AuthGuard('jwt'))
    findByUser(@Req() req: any) {
        return this.postService.findByUser(req.user.id);
    }

    @Get(':id')
    findById(@Param('id', ParseIntPipe) id: number) {
        return this.postService.findById(id);
    }

    @Post()
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(FilesInterceptor('images', 10))
    create(
        @Body() dto: CreatePostDto,
        @Req() req: any,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.postService.create(dto, req.user.id, files);
    }

    @Put(':id')
    @UseInterceptors(FilesInterceptor('images', 10))
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe({ 
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true 
        })) dto: UpdatePostDto,
        @UploadedFiles() files: Express.Multer.File[],   // vẫn giữ nguyên
    ) {
        console.log('📸 Số ảnh nhận được:', files?.length || 0);
        console.log('📝 DTO:', dto);
        return this.postService.update(id, dto, files);
    }

    @Put(':id/approve')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    approve(@Param('id', ParseIntPipe) id: number) {
        return this.postService.approve(id);
    }

    @Put(':id/reject')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    reject(@Param('id', ParseIntPipe) id: number) {
        return this.postService.reject(id);
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'))
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.postService.delete(id);
    }
}