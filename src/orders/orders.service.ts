import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Order } from './models/order.model'
import { OrderItem } from './models/order-item.model'
import { CreateOrderDto } from './dto/create-order.dto'
import { Sequelize } from 'sequelize-typescript'

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    @InjectModel(Order)
    private orderModel: typeof Order,
    @InjectModel(OrderItem)
    private orderItemModel: typeof OrderItem,
    private sequelize: Sequelize
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const transaction = await this.sequelize.transaction()

    try {
      const order = await this.orderModel.create(
        {
          customerName: createOrderDto.customerName,
          customerEmail: createOrderDto.customerEmail,
          customerPhone: createOrderDto.customerPhone,
          description: createOrderDto.description,
          shippingAddress: createOrderDto.shippingAddress,
          totalPrice: createOrderDto.totalPrice,
          userId: createOrderDto.userId
        },
        { transaction }
      )

      const orderItems = createOrderDto.orderItems.map((item) => ({
        orderId: order.id,
        paintingId: item.paintingId,
        quantity: item.quantity,
        price: item.price
      }))

      await this.orderItemModel.bulkCreate(orderItems, { transaction })
      await transaction.commit()
      return this.findOne(order.id)
    } catch (error) {
      await transaction.rollback()
      this.logger.error(`Error creating order: ${error.message}`, error.stack)
      throw error
    }
  }

  async findOne(id: number): Promise<Order> {
    return this.orderModel.findOne({
      where: { id },
      include: [{ model: OrderItem }]
    })
  }
}
