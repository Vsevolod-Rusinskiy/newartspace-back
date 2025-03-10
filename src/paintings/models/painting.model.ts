import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  BelongsToMany
} from 'sequelize-typescript'
import { Artist } from '../../artists/models/artist.model'
import { PaintingAttributes } from './painting-attributes.model'
import { Attributes } from '../../attributes/models/attributes.model'

@Table
export class Painting extends Model {
  @Column
  imgUrl: string

  @Column
  title: string

  @Column
  artType: string

  @Column
  price: number

  @Column
  isReproducible: boolean
  @Column
  discount: number

  @Column
  style: string

  @Column
  priceType: string
  @Column
  theme: string

  @Column
  material: string

  @Column
  technique: string

  @Column
  height: number

  @Column
  width: number

  @Column
  yearOfCreation: number

  @Column
  format: string

  @Column
  color: string

  @Column
  description: string

  @Column
  priority: number

  @Column
  artStyle: string

  @ForeignKey(() => Artist)
  @Column
  artistId: number

  @BelongsTo(() => Artist)
  artist: Artist

  @BelongsToMany(() => Attributes, () => PaintingAttributes)
  attributes: Attributes[]
}
