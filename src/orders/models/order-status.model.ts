import { Table, Column, Model, HasMany } from 'sequelize-typescript'
import { Order } from './order.model'

@Table({ tableName: 'OrderStatuses' })
export class OrderStatus extends Model {
  @Column
  name: string

  @Column
  displayName: string

  @Column
  description: string

  @Column
  color: string

  @Column
  sortOrder: number

  @HasMany(() => Order)
  orders: Order[]
}
