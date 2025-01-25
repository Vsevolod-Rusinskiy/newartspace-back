import { Module } from '@nestjs/common'
import { RequestFormService } from './request-form.service'
import { RequestFormController } from './request-form.controller'

@Module({
  controllers: [RequestFormController],
  providers: [RequestFormService]
})
/* eslint-disable */
export class RequestFormModule {}
/* eslint-enable */
