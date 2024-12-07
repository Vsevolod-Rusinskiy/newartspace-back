import { Table, Column, Model } from 'sequelize-typescript'

@Table
export class Event extends Model {
  @Column
  title: string

  @Column
  content: string

  @Column
  imgUrl: string

  @Column
  priority: number

  @Column
  date: Date
}
