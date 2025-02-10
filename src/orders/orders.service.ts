import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Order } from './models/order.model'
import { OrderItem } from './models/order-item.model'
import { OrderStatus } from './models/order-status.model'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { Sequelize } from 'sequelize-typescript'
import { Op } from 'sequelize'
import { Painting } from '../paintings/models/painting.model'

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
          include: [
            {
              model: OrderItem,
              include: [{ model: Painting }]
            },
            { model: OrderStatus }
          ],
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
      include: [
        {
          model: OrderItem,
          include: [{ model: Painting }]
        },
        { model: OrderStatus }
      ]
    })

    if (!order) {
      this.logger.warn(`Order with id ${id} not found`)
      throw new NotFoundException(`Order with id ${id} not found`)
    }

    return order
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const transaction = await this.sequelize.transaction()

    try {
      const order = await this.orderModel.findOne({
        where: { id },
        include: [{ model: OrderItem }, { model: OrderStatus }]
      })

      if (!order) {
        throw new NotFoundException(`Order with id ${id} not found`)
      }

      // Если передан statusId, проверяем существование статуса
      if (updateOrderDto.statusId) {
        const status = await this.orderStatusModel.findOne({
          where: { id: updateOrderDto.statusId }
        })

        if (!status) {
          throw new NotFoundException(
            `Status with id ${updateOrderDto.statusId} not found`
          )
        }
      }

      // Обновляем основные поля заказа
      await order.update(updateOrderDto, { transaction })

      // Если переданы orderItems, обновляем их
      if (updateOrderDto.orderItems) {
        // Удаляем старые orderItems
        await this.orderItemModel.destroy({
          where: { orderId: id },
          transaction
        })

        // Создаем новые orderItems
        const orderItems = updateOrderDto.orderItems.map((item) => ({
          orderId: id,
          paintingId: item.paintingId,
          quantity: item.quantity,
          price: item.price
        }))

        await this.orderItemModel.bulkCreate(orderItems, { transaction })
      }

      await transaction.commit()

      // Возвращаем обновленный заказ
      return this.findOne(id)
    } catch (error) {
      await transaction.rollback()
      this.logger.error(`Error updating order: ${error.message}`, error.stack)
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

  async delete(id: number): Promise<void> {
    const transaction = await this.sequelize.transaction()

    try {
      const order = await this.orderModel.findOne({
        where: { id },
        transaction
      })

      if (!order) {
        throw new NotFoundException(`Order with id ${id} not found`)
      }

      // Удаляем связанные orderItems
      await this.orderItemModel.destroy({
        where: { orderId: id },
        transaction
      })

      // Удаляем сам заказ
      await order.destroy({ transaction })

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      this.logger.error(`Error deleting order: ${error.message}`, error.stack)
      throw error
    }
  }

  async deleteMany(ids: string): Promise<{ deletedCount: number }> {
    const transaction = await this.sequelize.transaction()
    let deletedCount = 0

    try {
      const idArray = JSON.parse(ids).map((id) => id.toString())

      // Удаляем связанные orderItems
      await this.orderItemModel.destroy({
        where: {
          orderId: {
            [Op.in]: idArray
          }
        },
        transaction
      })

      // Удаляем заказы
      deletedCount = await this.orderModel.destroy({
        where: {
          id: {
            [Op.in]: idArray
          }
        },
        transaction
      })

      await transaction.commit()
      return { deletedCount }
    } catch (error) {
      await transaction.rollback()
      this.logger.error(`Error deleting orders: ${error.message}`, error.stack)
      throw error
    }
  }

  async getMany(ids: string) {
    if (!ids) {
      return []
    }

    const idArray = ids.split(',').map((id) => +id)

    if (!idArray.length) {
      return []
    }

    const orders = await this.orderModel.findAll({
      where: {
        id: {
          [Op.in]: idArray
        }
      },
      include: [
        {
          model: OrderItem,
          include: [{ model: Painting }]
        },
        { model: OrderStatus }
      ]
    })

    return orders
  }

  async deleteItems(orderId: number, itemIds: number[]): Promise<void> {
    const transaction = await this.sequelize.transaction()
    this.logger.debug(
      `Starting deleteItems. OrderId: ${orderId}, ItemIds: ${itemIds}`
    )

    try {
      const order = await this.orderModel.findOne({
        where: { id: orderId },
        include: [{ model: OrderItem }],
        transaction
      })

      if (!order) {
        throw new NotFoundException(`Order with id ${orderId} not found`)
      }

      this.logger.debug(
        `Current order items: ${JSON.stringify(order.orderItems)}`
      )
      this.logger.debug(
        `Found order ${orderId}, deleting items with ids: ${itemIds}`
      )

      const result = await this.orderItemModel.destroy({
        where: {
          orderId,
          id: {
            [Op.in]: itemIds
          }
        },
        transaction
      })

      this.logger.debug(`Deleted ${result} items`)
      await transaction.commit()
      this.logger.debug(`Successfully deleted items from order ${orderId}`)
    } catch (error) {
      await transaction.rollback()
      this.logger.error(
        `Error deleting order items: ${error.message}`,
        error.stack
      )
      throw error
    }
  }
}
