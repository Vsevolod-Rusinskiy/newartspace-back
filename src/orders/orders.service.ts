import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Order } from './models/order.model'
import { OrderItem } from './models/order-item.model'
import { OrderStatus } from './models/order-status.model'
import { CreateOrderDto } from './dto/create-order.dto'
import { Sequelize } from 'sequelize-typescript'
import { Op } from 'sequelize'

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    @InjectModel(Order)
    private orderModel: typeof Order,
    @InjectModel(OrderItem)
    private orderItemModel: typeof OrderItem,
    @InjectModel(OrderStatus)
    private orderStatusModel: typeof OrderStatus,
    private sequelize: Sequelize
  ) {}

  async findAll(
    sort?: string,
    order?: 'ASC' | 'DESC',
    page?: number,
    limit?: number,
    filter?: string
  ) {
    try {
      order = order || 'DESC'
      page = page !== undefined ? page : 1
      limit = limit !== undefined ? limit : 10

      let sortField = 'createdAt'
      if (sort) {
        try {
          const parsedSort = JSON.parse(sort)
          if (Array.isArray(parsedSort) && parsedSort.length === 2) {
            sortField = parsedSort[0]
            order = parsedSort[1]
          }
        } catch (error) {
          this.logger.error('Failed to parse sort parameter:', error)
        }
      }

      // Подготавливаем условия поиска
      const whereConditions: any = {}
      if (filter) {
        try {
          const searchFilter = JSON.parse(filter)
          if (searchFilter.customerEmail) {
            whereConditions.customerEmail = {
              [Op.iLike]: `%${searchFilter.customerEmail}%`
            }
          }
          if (searchFilter.customerName) {
            whereConditions.customerName = {
              [Op.iLike]: `%${searchFilter.customerName}%`
            }
          }
          if (searchFilter.statusId) {
            whereConditions.statusId = searchFilter.statusId
          }
        } catch (error) {
          this.logger.error('Failed to parse filter:', error)
        }
      }

      const { rows: data, count: total } =
        await this.orderModel.findAndCountAll({
          where: whereConditions,
          include: [{ model: OrderItem }, { model: OrderStatus }],
          order: [[sortField, order]],
          limit: limit,
          offset: (page - 1) * limit,
          distinct: true
        })

      return {
        data,
        total,
        page,
        pageCount: Math.ceil(total / limit)
      }
    } catch (error) {
      this.logger.error(`Error getting orders: ${error.message}`, error.stack)
      throw error
    }
  }

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
          userId: createOrderDto.userId,
          statusId: 1 // Статус NEW
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
    const order = await this.orderModel.findOne({
      where: { id },
      include: [{ model: OrderItem }, { model: OrderStatus }]
    })

    if (!order) {
      this.logger.warn(`Order with id ${id} not found`)
      throw new NotFoundException(`Order with id ${id} not found`)
    }

    return order
  }

  async updateStatus(orderId: number, statusId: number): Promise<Order> {
    try {
      // Проверяем существование статуса
      const status = await this.orderStatusModel.findOne({
        where: { id: statusId }
      })

      if (!status) {
        this.logger.warn(`Status with id ${statusId} not found`)
        throw new NotFoundException(`Status with id ${statusId} not found`)
      }

      // Проверяем существование заказа
      const order = await this.orderModel.findOne({
        where: { id: orderId }
      })

      if (!order) {
        this.logger.warn(`Order with id ${orderId} not found`)
        throw new NotFoundException(`Order with id ${orderId} not found`)
      }

      // Обновляем статус
      order.statusId = statusId
      await order.save()

      this.logger.log(`Updated order ${orderId} status to ${statusId}`)

      // Возвращаем обновленный заказ со всеми связями
      return this.findOne(orderId)
    } catch (error) {
      this.logger.error(
        `Error updating order ${orderId} status: ${error.message}`,
        error.stack
      )
      throw error
    }
  }

  async getStatuses(): Promise<OrderStatus[]> {
    try {
      return await this.orderStatusModel.findAll({
        order: [['sortOrder', 'ASC']]
      })
    } catch (error) {
      this.logger.error(`Error getting statuses: ${error.message}`, error.stack)
      throw error
    }
  }
}
