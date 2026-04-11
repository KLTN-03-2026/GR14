import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.id);
  }

  @Put()
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, dto);
  }

  @Put('change-password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(req.user.id, dto);
  }
}
