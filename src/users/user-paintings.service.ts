import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { UserPainting } from './models/user-paintings.model'
import { UpdateUserPaintingsDto } from './dto/update-user-paintings.dto'

@Injectable()
export class UserPaintingsService {
  private readonly logger = new Logger(UserPaintingsService.name)

  constructor(
    @InjectModel(UserPainting)
    private userPaintingModel: typeof UserPainting
  ) {}

  async getUserPaintings(_userId: number) {
    this.logger.log(`Getting paintings for user ${_userId}`)
    // TODO: Реализовать после добавления авторизации
    return {
      favorites: [],
      cart: []
    }
  }

  async updateUserPaintings(_userId: number, _data: UpdateUserPaintingsDto) {
    // TODO: Реализовать после добавления авторизации
    this.logger.log(`Updating paintings for user ${_userId}`, _data)
    return {
      favorites: [],
      cart: []
    }
  }
}
