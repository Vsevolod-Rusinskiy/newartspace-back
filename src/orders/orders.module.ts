import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { Order } from './models/order.model'
import { OrderItem } from './models/order-item.model'
import { OrderStatus } from './models/order-status.model'
import { OrdersService } from './orders.service'
import { OrdersController } from './orders.controller'
import { Painting } from '../paintings/models/painting.model'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    SequelizeModule.forFeature([Order, OrderItem, OrderStatus, Painting]),
    AuthModule
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService]
})
/* eslint-disable */
export class OrdersModule {}
