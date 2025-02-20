import { Injectable, Logger } from '@nestjs/common'
import { CreateProfileDto } from './dto/create-profile.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'
import * as bcrypt from 'bcryptjs'
import { User } from '../users/models/user.model'
import { InjectModel } from '@nestjs/sequelize'
import { Order } from 'src/orders/models/order.model'
import { OrderItem } from 'src/orders/models/order-item.model'
import { OrderStatus } from 'src/orders/models/order-status.model'
import { Painting } from 'src/paintings/models/painting.model'
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name)

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
    @InjectModel(OrderItem)
    private readonly orderItemModel: typeof OrderItem,
    @InjectModel(OrderStatus)
    private readonly orderStatusModel: typeof OrderStatus,
    @InjectModel(Painting)
    private readonly paintingModel: typeof Painting
  ) {}

  create(createProfileDto: CreateProfileDto) {
    console.log(createProfileDto)
    return 'This action adds a new profile'
  }

  async findAll() {
    return `This action returns all profile`
  }

  async getUserInfo(userId: number) {
    const user = await this.userModel.findOne({
      where: { id: userId },
      attributes: ['id', 'userName', 'email']
    })

    return user
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const updates: any = {}

    if (updateProfileDto.userName) {
      updates.userName = updateProfileDto.userName
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
      include: [
        {
          model: OrderItem,
          include: [
            {
              model: Painting,
              attributes: ['id', 'title', 'price', 'imgUrl']
            }
          ]
        },
        {
          model: OrderStatus,
          attributes: ['id', 'displayName']
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    return purchases
  }
}
