import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement
} from 'sequelize-typescript'

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
}
