import { Table, Column, Model } from 'sequelize-typescript'

@Table
export class Welcomes extends Model {
  @Column
  content: string
}
