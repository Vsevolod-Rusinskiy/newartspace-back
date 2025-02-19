import { Injectable, Logger } from '@nestjs/common'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import * as bcrypt from 'bcryptjs'
import { User } from '../users/models/user.model'
import { InjectModel } from '@nestjs/sequelize'
import { Order } from 'src/orders/models/order.model'

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name)

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Order)
    private readonly orderModel: typeof Order
  ) {}

  create(createProfileDto: CreateProfileDto) {
    console.log(createProfileDto)
    return 'This action adds a new profile'
  }

  async findAll() {
    // ищем покупки пользователя
    return `This action returns all profile`
  }

  async getUserInfo(userId: number) {
    const user = await this.userModel.findOne({
      where: { id: userId },
      attributes: ['id', 'userName', 'email', 'phone'] // исключаем пароль и другие чувствительные данные
    })

    return user
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const updates: any = {}

    if (updateProfileDto.userName) {
      updates.userName = updateProfileDto.userName
    }

    if (updateProfileDto.phone) {
      updates.phone = updateProfileDto.phone
    }

    if (updateProfileDto.newPassword) {
      updates.userPassword = await bcrypt.hash(updateProfileDto.newPassword, 10)
    }

    await this.userModel.update(updates, {
      where: { id: userId }
    })

    return { message: 'Профиль успешно обновлен' }
  }

  async getUserPurchases(userId: number) {
    const purchases = await this.orderModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']], // сортировка по дате создания
      include: [
        {
          all: true // включаем все связанные модели (можно настроить конкретные)
        }
      ]
    })

    return purchases
  }
}
