import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { UserPainting } from './models/user-paintings.model'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { UpdateUserPaintingsDto } from './dto/update-user-paintings.dto'
import { Transaction } from 'sequelize'

@Injectable()
export class UserPaintingsService {
  private readonly logger = new Logger(UserPaintingsService.name)

  constructor(
    @InjectModel(UserPainting)
    private userPaintingModel: typeof UserPainting
  ) {}

  async getUserPaintings(userId: number) {
    const [favorites, cart] = await Promise.all([
      this.userPaintingModel.findAll({
        where: { userId, type: 'favorite' },
        include: [
          {
            model: Painting,
            include: [Artist]
          }
        ]
      }),
      this.userPaintingModel.findAll({
        where: { userId, type: 'cart' },
        include: [
          {
            model: Painting,
            include: [Artist]
          }
        ]
      })
    ])

    return {
      favorites: favorites.map((f) => f.painting),
      cart: cart.map((c) => c.painting)
    }
  }

  async updateUserPaintings(
    userId: number,
    data: UpdateUserPaintingsDto,
    transaction?: Transaction
  ) {
    try {
      // Удаляем все текущие записи пользователя
      await this.userPaintingModel.destroy({
        where: { userId },
        transaction
      })

      // Создаем новые записи для избранного
      const favoriteRecords = data.favorites.map((paintingId) => ({
        userId,
        paintingId,
        type: 'favorite'
      }))

      // Создаем новые записи для корзины
      const cartRecords = data.cart.map((paintingId) => ({
        userId,
        paintingId,
        type: 'cart'
      }))

      // Создаем все записи одним запросом
      await this.userPaintingModel.bulkCreate(
        [...favoriteRecords, ...cartRecords],
        { transaction }
      )

      return this.getUserPaintings(userId)
    } catch (error) {
      this.logger.error(`Error updating user paintings: ${error.message}`)
      throw error
    }
  }
}
