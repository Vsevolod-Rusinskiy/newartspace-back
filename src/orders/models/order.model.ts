import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo,
  HasMany,
  DataType
} from 'sequelize-typescript'
import { User } from '../../users/models/user.model'
import { OrderStatus } from '../enums/order-status.enum'
import { OrderItem } from './order-item.model'

@Table
export class Order extends Model {
  @Column
  customerName: string

  @Column
  customerEmail: string

  @Column
  customerPhone: string

  @Column({ allowNull: true })
  description: string

  @Column({ allowNull: true })
  shippingAddress: string

  @Column
  totalPrice: number

  @Column({
    type: DataType.ENUM(...Object.values(OrderStatus)),
    defaultValue: OrderStatus.NEW
  })
  status: OrderStatus

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number

  @BelongsTo(() => User)
  user: User

  @HasMany(() => OrderItem)
  orderItems: OrderItem[]
}
