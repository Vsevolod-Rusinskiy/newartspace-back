import { Table, Column, Model, HasMany } from 'sequelize-typescript'
import { EventPhoto } from './event-photo.model'

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

  @HasMany(() => EventPhoto)
  eventPhotos: EventPhoto[]
}
