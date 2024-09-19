import { Table, Column, Model } from 'sequelize-typescript'

@Table
export class Attributes extends Model {
  @Column
  type: string

  @Column
  value: string

  @Column
  priority: number
}
