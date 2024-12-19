import { Table, Column, Model } from 'sequelize-typescript'

@Table
export class User extends Model {
  @Column
  userName: string

  @Column
  userPassword: string

  @Column
  email: string
}
