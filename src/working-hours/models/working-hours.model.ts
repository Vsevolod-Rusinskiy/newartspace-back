import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement
} from 'sequelize-typescript'

@Table({
  tableName: 'WorkingHours'
})
export class WorkingHours extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number

  @Column
  scheduleText: string

  @Column
  appointmentText: string
}
