import { Module } from '@nestjs/common'
import { AttributesService } from './attributes.service'
import { AttributesController } from './attributes.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Attributes } from './models/attributes.model'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SequelizeModule.forFeature([Attributes]), AuthModule],
  controllers: [AttributesController],
  providers: [AttributesService]
})
export class AttributesModule {}
