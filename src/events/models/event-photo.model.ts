import { Table, Column, Model } from 'sequelize-typescript'

@Table({
  tableName: 'EventsPhotos'
})
export class EventPhoto extends Model {
  @Column
  imgUrl: string

  @Column
  title: string

  @Column
  priority: number
}
