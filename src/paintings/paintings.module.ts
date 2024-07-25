import { Module } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { PaintingsController } from './paintings.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from './models/painting.model'
import { StorageModule } from '../common/services/storage.module'

@Module({
  imports: [SequelizeModule.forFeature([Painting]), StorageModule],
  providers: [PaintingsService],
  controllers: [PaintingsController]
})
export class PaintingsModule {}
