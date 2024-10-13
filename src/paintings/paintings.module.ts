import { Module } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { PaintingsController } from './paintings.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from './models/painting.model'
import { StorageModule } from '../common/services/storage.module'
import { Attributes } from 'src/attributes/models/attributes.model'

@Module({
  imports: [SequelizeModule.forFeature([Painting, Attributes]), StorageModule],
  providers: [PaintingsService],
  controllers: [PaintingsController]
})
export class PaintingsModule {}
