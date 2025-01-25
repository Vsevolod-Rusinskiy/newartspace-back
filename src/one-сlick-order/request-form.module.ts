import { Module } from '@nestjs/common'
import { RequestFormController } from './request-form.controller'
import { RequestFormService } from './request-form.service'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'

@Module({
  imports: [SequelizeModule.forFeature([Painting])],
  controllers: [RequestFormController],
  providers: [RequestFormService]
})
/* eslint-disable */
export class RequestFormModule {}
/* eslint-enable */
