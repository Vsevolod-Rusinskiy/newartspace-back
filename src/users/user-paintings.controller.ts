import { Controller, Get, Put, Body, Logger, Param } from '@nestjs/common'
import { UserPaintingsService } from './user-paintings.service'
import { UpdateUserPaintingsDto } from './dto/update-user-paintings.dto'

@Controller('user-paintings')
export class UserPaintingsController {
  private readonly logger = new Logger(UserPaintingsController.name)

  constructor(private readonly userPaintingsService: UserPaintingsService) {}

  @Get(':userId')
  async getUserPaintings(@Param('userId') userId: number) {
    this.logger.log(`Getting paintings for user ${userId}`)
    return this.userPaintingsService.getUserPaintings(userId)
  }

  @Put(':userId')
  async updateUserPaintings(
    @Param('userId') userId: number,
    @Body() updateUserPaintingsDto: UpdateUserPaintingsDto
  ) {
    this.logger.log(`Updating paintings for user ${userId}`)
    return this.userPaintingsService.updateUserPaintings(
      userId,
      updateUserPaintingsDto
    )
  }
}
