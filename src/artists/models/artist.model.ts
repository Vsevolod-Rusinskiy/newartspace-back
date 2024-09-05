import { Table, Column, Model, HasMany } from 'sequelize-typescript'
import { Painting } from '../../paintings/models/painting.model'

@Table
export class Artist extends Model {
  @Column
  artistName: string

  @Column
  artistDescription: string

  @Column
  imgUrl: string

  @Column
  priority: number

  @HasMany(() => Painting)
  paintings: Painting[]
}
