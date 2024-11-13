import { Model, ForeignKey, Column, Table } from 'sequelize-typescript'
import { Painting } from './painting.model'
import { Attributes } from '../../attributes/models/attributes.model'

@Table
export class PaintingAttributes extends Model {
  @ForeignKey(() => Painting)
  @Column
  paintingId: number

  @ForeignKey(() => Attributes)
  @Column
  attributeId: number
}
