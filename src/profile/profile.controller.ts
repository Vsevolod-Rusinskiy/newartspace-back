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
import { JWTGuard } from 'src/auth/guards/jwt.guard'
import { AuthService } from 'src/auth/auth.service'
import { Request as ExpressRequest } from 'express'
import { UpdateProfileDto } from './dto/update-profile.dto'

interface Request extends ExpressRequest {
  token: string
}

@Controller('profile')
@UseGuards(JWTGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name)

  constructor(
    private readonly profileService: ProfileService,
    private readonly authService: AuthService
  ) {}

  @Get('info')
  async getUserInfo(@Req() req: Request) {
    const token = req.headers.authorization.split(' ')[1]
    const user = await this.authService.getUserEmailByTokenData(token)
    return this.profileService.getUserInfo(user.id)
  }

  @Patch('info')
  async updateProfile(
    @Req() req: Request,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    const token = req.headers.authorization.split(' ')[1]
    const user = await this.authService.getUserEmailByTokenData(token)
    return this.profileService.updateProfile(user.id, updateProfileDto)
  }

  @Get('purchases')
  async getUserPurchases(@Req() req: Request) {
    const token = req.headers.authorization.split(' ')[1]
    const user = await this.authService.getUserEmailByTokenData(token)
    return this.profileService.getUserPurchases(user.id)
  }
}
