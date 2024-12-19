import {
  Controller,
  Get,
  // Post,
  // Body,
  // Patch,
  // Param,
  // Delete,
  UseGuards,
  Res,
  HttpStatus,
  Req,
  HttpCode,
  Logger
} from '@nestjs/common'
import { ProfileService } from './profile.service'
import { JWTGuard } from 'src/auth/guards/jwt.guard'
import { AuthService } from 'src/auth/auth.service'
import { Response } from 'express'
import { Request as ExpressRequest } from 'express'

interface Request extends ExpressRequest {
  token: string
}

@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name)

  constructor(
    private readonly profileService: ProfileService,
    private readonly authService: AuthService
  ) {}

  @UseGuards(JWTGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPurchases(@Req() req: Request, @Res() res: Response) {
    // this.logger.log(req, 'token', 222)
    // console.log(req, 11111111)
    // const token = req.token
    // const user = await this.authService.getUserEmailByTokenData(token)
    const purchases = await this.profileService.findAll()

    return res.send(purchases)
  }
}
