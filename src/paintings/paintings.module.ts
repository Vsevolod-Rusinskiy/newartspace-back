import { Module } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { PaintingsController } from './paintings.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { Attributes } from '../attributes/models/attributes.model'
import { AttributesModule } from '../attributes/attributes.module'
import { StorageModule } from 'src/common/services/storage.module'

@Module({
  imports: [
    SequelizeModule.forFeature([Painting, PaintingAttributes, Attributes]),
    AttributesModule,
    StorageModule
  ],
  providers: [PaintingsService],
  controllers: [PaintingsController]
})
export class PaintingsModule {}
