import { Module } from '@nestjs/common'
import { ProfileService } from './profile.service'
import { ProfileController } from './profile.controller'
import { AuthModule } from 'src/auth/auth.module'
import { UsersModule } from 'src/users/users.module'
import { SequelizeModule } from '@nestjs/sequelize'
import { User } from 'src/users/models/user.model'
import { Order } from 'src/orders/models/order.model'
import { OrdersModule } from 'src/orders/orders.module'

@Module({
  imports: [
    AuthModule,
    UsersModule,
    SequelizeModule.forFeature([User, Order]),
    OrdersModule
  ],
  controllers: [ProfileController],
  providers: [ProfileService]
})
export class ProfileModule {}
