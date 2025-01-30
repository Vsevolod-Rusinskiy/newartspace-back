import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table
export class User extends Model {
  @Column
  userName: string

  @Column
  userPassword: string

  @Column
  email: string

  @Column({ defaultValue: false })
  isEmailVerified: boolean

  @Column({ allowNull: true })
  verificationToken: string

  @Column({ allowNull: true })
  resetPasswordToken: string

  @Column({ allowNull: true })
  resetPasswordExpires: Date

  @Column({ defaultValue: false })
  isAdmin: boolean

  @Column({
    type: DataType.ARRAY(DataType.INTEGER),
    defaultValue: []
  })
  favorites: number[]

  @Column({
    type: DataType.ARRAY(DataType.INTEGER),
    defaultValue: []
  })
  cart: number[]
}
