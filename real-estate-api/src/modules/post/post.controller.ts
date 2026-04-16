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
import { CreatePostDto, UpdatePostDto, PostType } from './dto/post.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get('approved')
  findApproved(
    @Query('page') page = 1,
    @Query('limit') limit = 6,
    @Query('postType') postType?: PostType,
  ) {
    return this.postService.findApproved(+page, +limit, postType);
  }

  @Get('pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  findPending(@Query('postType') postType?: PostType) {
    return this.postService.findPending(postType);
  }

  @Get('all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('postType') postType?: PostType,
  ) {
    return this.postService.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      status: status ? +status : undefined,
      search,
      postType,
    });
  }

  @Get('my-posts')
  @UseGuards(AuthGuard('jwt'))
  findByUser(@Req() req: any, @Query('postType') postType?: PostType) {
    return this.postService.findByUser(req.user.id, postType);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.postService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FilesInterceptor('images', 10))
  create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePostDto,
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postService.create(dto, req.user.id, files, req.user.roles);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FilesInterceptor('images', 10))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: UpdatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.postService.update(id, dto, req.user.id, files);
  }

  @Put(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.postService.approve(id);
  }

  @Put(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.postService.reject(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.postService.delete(id, req.user.id, req.user.roles);
  }
}
