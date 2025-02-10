import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript'
import { Order } from './order.model'
import { Painting } from '../../paintings/models/painting.model'

@Table
export class OrderItem extends Model {
  @ForeignKey(() => Order)
  @Column
  orderId: number

  @ForeignKey(() => Painting)
  @Column
  paintingId: number

  @Column
  quantity: number

  @Column
  price: number

  @BelongsTo(() => Order)
  order: Order

  @BelongsTo(() => Painting)
  painting: Painting
}
