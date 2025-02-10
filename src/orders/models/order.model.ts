import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo,
  HasMany
} from 'sequelize-typescript'
import { User } from '../../users/models/user.model'
import { OrderItem } from './order-item.model'
import { OrderStatus } from './order-status.model'

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

  @ForeignKey(() => OrderStatus)
  @Column
  statusId: number

  @BelongsTo(() => OrderStatus)
  status: OrderStatus

  @ForeignKey(() => User)
  @Column({ allowNull: true })
  userId: number

  @BelongsTo(() => User)
  user: User

  @HasMany(() => OrderItem)
  orderItems: OrderItem[]
}
