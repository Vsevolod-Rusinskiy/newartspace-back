import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { UserPainting } from './models/user-paintings.model'
import { UpdateUserPaintingsDto } from './dto/update-user-paintings.dto'
import { Painting } from '../paintings/models/painting.model'

@Injectable()
export class UserPaintingsService {
  private readonly logger = new Logger(UserPaintingsService.name)

  constructor(
    @InjectModel(UserPainting)
    private userPaintingModel: typeof UserPainting
  ) {}

  async getUserPaintings(userId: number) {
    this.logger.log(`Getting paintings for user ${userId}`)

    const userPaintings = await this.userPaintingModel.findAll({
      where: { userId },
      include: [{ model: Painting }]
    })

    const result = {
      favorites: userPaintings
        .filter((p) => p.type === 'favorite')
        .map((p) => p.paintingId),
      cart: userPaintings
        .filter((p) => p.type === 'cart')
        .map((p) => p.paintingId)
    }

    this.logger.log(`Sending to frontend for user ${userId}:`, {
      favorites: result.favorites,
      cart: result.cart
    })
    return result
  }

  async updateUserPaintings(userId: number, data: UpdateUserPaintingsDto) {
    this.logger.log(`Updating paintings for user ${userId}`, data)

    // Удаляем старые записи
    await this.userPaintingModel.destroy({
      where: { userId }
    })
    this.logger.log(`Deleted old paintings for user ${userId}`)

    // Сохраняем новые записи
    const userPaintings = [
      ...data.favorites.map((paintingId) => ({
        userId,
        paintingId,
        type: 'favorite'
      })),
      ...data.cart.map((paintingId) => ({ userId, paintingId, type: 'cart' }))
    ]

    await this.userPaintingModel.bulkCreate(userPaintings)
    this.logger.log(`Created new paintings for user ${userId}:`, userPaintings)

    // Получаем обновленные данные
    const updatedPaintings = await this.userPaintingModel.findAll({
      where: { userId },
      include: [{ model: Painting }]
    })

    // Разделяем данные на избранное и корзину
    const result = {
      favorites: updatedPaintings
        .filter((p) => p.type === 'favorite')
        .map((p) => p.paintingId),
      cart: updatedPaintings
        .filter((p) => p.type === 'cart')
        .map((p) => p.paintingId)
    }

    this.logger.log(
      `Sending updated data to frontend for user ${userId}:`,
      result
    )
    return result
  }
}
