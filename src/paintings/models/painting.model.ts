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
  theme: string

  @Column
  style: string

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
  techniques: string

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
