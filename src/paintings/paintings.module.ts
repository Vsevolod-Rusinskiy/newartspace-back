import { Module } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { PaintingsController } from './paintings.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from './models/painting.model'
import { StorageService } from '../common/services/storage.service'

@Module({
  imports: [SequelizeModule.forFeature([Painting])],
  providers: [PaintingsService, StorageService],
  controllers: [PaintingsController]
})
export class PaintingsModule {}
