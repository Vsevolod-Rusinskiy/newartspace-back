import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table
export class Welcomes extends Model {
  @Column(DataType.TEXT)
  content: string

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  isActive: boolean
}
