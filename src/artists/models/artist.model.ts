import { Table, Column, Model } from 'sequelize-typescript'

@Table
export class Artist extends Model {
  @Column
  artistName: string

  @Column
  artistDescription: string

  @Column
  artistUrl: string
}
