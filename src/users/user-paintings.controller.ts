import {
  Controller,
  Get,
  Put,
  Body,
  Logger,
  Req,
  UseGuards
} from '@nestjs/common'
import { UserPaintingsService } from './user-paintings.service'
import { UpdateUserPaintingsDto } from './dto/update-user-paintings.dto'
import {
  UserPaintingsOwnerGuard,
  UserPaintingsRequest
} from './user-paintings-owner.guard'

@Controller('user-paintings')
@UseGuards(UserPaintingsOwnerGuard)
export class UserPaintingsController {
  private readonly logger = new Logger(UserPaintingsController.name)

  constructor(private readonly userPaintingsService: UserPaintingsService) {}

  @Get(':userId')
  async getUserPaintings(@Req() request: UserPaintingsRequest) {
    const userId = request.userPaintingsUserId
    this.logger.log(`Getting paintings for user ${userId}`)
    return this.userPaintingsService.getUserPaintings(userId)
  }

  @Put(':userId')
  async updateUserPaintings(
    @Req() request: UserPaintingsRequest,
    @Body() updateUserPaintingsDto: UpdateUserPaintingsDto
  ) {
    const userId = request.userPaintingsUserId
    this.logger.log(`Updating paintings for user ${userId}`)
    return this.userPaintingsService.updateUserPaintings(
      userId,
      updateUserPaintingsDto
    )
  }
}
