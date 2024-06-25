import { Module } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { PaintingsController } from './paintings.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from './models/painting.model'

@Module({
  imports: [SequelizeModule.forFeature([Painting])],
  providers: [PaintingsService],
  controllers: [PaintingsController],
})
export class PaintingsModule {}
