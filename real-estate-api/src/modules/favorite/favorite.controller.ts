import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoriteService } from './favorite.service';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  findByUser(@Req() req: any) {
    return this.favoriteService.findByUser(req.user.id);
  }

  @Post('house/:id')
  addHouse(@Param('id', ParseIntPipe) houseId: number, @Req() req: any) {
    return this.favoriteService.addHouse(req.user.id, houseId);
  }

  @Post('land/:id')
  addLand(@Param('id', ParseIntPipe) landId: number, @Req() req: any) {
    return this.favoriteService.addLand(req.user.id, landId);
  }

  @Delete('house/:id')
  removeHouse(@Param('id', ParseIntPipe) houseId: number, @Req() req: any) {
    return this.favoriteService.removeHouse(req.user.id, houseId);
  }

  @Delete('land/:id')
  removeLand(@Param('id', ParseIntPipe) landId: number, @Req() req: any) {
    return this.favoriteService.removeLand(req.user.id, landId);
  }
}
