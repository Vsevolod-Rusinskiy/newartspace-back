import {
  Controller,
  Get,
  Patch,
  UseGuards,
  Req,
  Logger,
  Body
} from '@nestjs/common'
import { ProfileService } from './profile.service'
import { JWTGuard, AuthenticatedRequest } from 'src/auth/guards/jwt.guard'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('profile')
@UseGuards(JWTGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name)

  constructor(private readonly profileService: ProfileService) {}

  @Get('info')
  async getUserInfo(@Req() req: AuthenticatedRequest) {
    const user = req.authUser
    return this.profileService.getUserInfo(user.id)
  }

  @Patch('info')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    const user = req.authUser
    return this.profileService.updateProfile(user.id, updateProfileDto)
  }

  @Get('purchases')
  async getUserPurchases(@Req() req: AuthenticatedRequest) {
    const user = req.authUser
    return this.profileService.getUserPurchases(user.id)
  }
}
