import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { Order } from './models/order.model'
import { OrderItem } from './models/order-item.model'
import { OrderStatus } from './models/order-status.model'
import { OrdersService } from './orders.service'
import { OrdersController } from './orders.controller'

@Module({
  imports: [SequelizeModule.forFeature([Order, OrderItem, OrderStatus])],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService]
})
/* eslint-disable */
export class OrdersModule {}
