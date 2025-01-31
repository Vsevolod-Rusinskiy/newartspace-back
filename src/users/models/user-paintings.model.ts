import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo,
  DataType
} from 'sequelize-typescript'
import { User } from './user.model'
import { Painting } from '../../paintings/models/painting.model'

@Table
export class UserPainting extends Model {
  @ForeignKey(() => User)
  @Column
  userId: number

  @ForeignKey(() => Painting)
  @Column
  paintingId: number

  @Column({
    type: DataType.ENUM('favorite', 'cart')
  })
  type: 'favorite' | 'cart'

  @BelongsTo(() => User)
  user: User

  @BelongsTo(() => Painting)
  painting: Painting
}
