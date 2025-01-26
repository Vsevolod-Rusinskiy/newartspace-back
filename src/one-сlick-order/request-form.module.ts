import { Module } from '@nestjs/common'
import { RequestFormController } from './request-form.controller'
import { RequestFormService } from './request-form.service'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'
import { MailModule } from '../mail/mail.module'

@Module({
  imports: [SequelizeModule.forFeature([Painting]), MailModule],
  controllers: [RequestFormController],
  providers: [RequestFormService]
})
/* eslint-disable */
export class RequestFormModule {}
/* eslint-enable */
