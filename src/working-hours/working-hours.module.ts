import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { WorkingHours } from './models/working-hours.model'
import { WorkingHoursService } from './working-hours.service'
import { WorkingHoursController } from './working-hours.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SequelizeModule.forFeature([WorkingHours]), AuthModule],
  controllers: [WorkingHoursController],
  providers: [WorkingHoursService]
})
export class WorkingHoursModule {}
