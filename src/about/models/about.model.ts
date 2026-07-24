import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType
} from 'sequelize-typescript'

@Table({
  tableName: 'AboutPage'
})
export class About extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number

  @Column
  imgUrl: string

  @Column(DataType.TEXT)
  mainText: string

  @Column(DataType.TEXT)
  additionalText1: string

  @Column(DataType.TEXT)
  additionalText2: string
}
