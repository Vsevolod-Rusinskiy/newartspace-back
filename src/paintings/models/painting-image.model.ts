import { Column, ForeignKey, Model, Table } from 'sequelize-typescript'
import { Painting } from './painting.model'

@Table
export class PaintingImage extends Model {
  @ForeignKey(() => Painting)
  @Column
  paintingId: number

  @Column
  imgUrl: string

  @Column
  position: number
}
