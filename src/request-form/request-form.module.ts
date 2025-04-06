import { Module } from '@nestjs/common'
import { RequestFormController } from './request-form.controller'
import { RequestFormService } from './request-form.service'
import { SequelizeModule } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'
import { MailModule } from '../mail/mail.module'
import { OrdersModule } from '../orders/orders.module'
import { UsersModule } from '../users/users.module'
import { EmailTemplatesModule } from '../email-templates/email-templates.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports: [
    SequelizeModule.forFeature([Painting]),
    MailModule,
    OrdersModule,
    UsersModule,
    EmailTemplatesModule,
    TelegramModule
  ],
  controllers: [RequestFormController],
  providers: [RequestFormService]
})
/* eslint-disable */
export class RequestFormModule {}
/* eslint-enable */
