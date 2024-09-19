import { Module } from '@nestjs/common'
import { AttributesService } from './attributes.service'
import { AttributesController } from './attributes.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Attributes } from './models/attributes.model'

@Module({
  imports: [SequelizeModule.forFeature([Attributes])],
  controllers: [AttributesController],
  providers: [AttributesService]
})
export class AttributesModule {}
