import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript'
import { Event } from './event.model'

@Table({
  tableName: 'EventsPhotos'
})
export class EventPhoto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number

  @Column
  imgUrl: string

  @Column
  title: string

  @Column
  priority: number

  @ForeignKey(() => Event)
  @Column({ field: 'eventId' })
  eventId: number

  @BelongsTo(() => Event)
  event: Event
}
