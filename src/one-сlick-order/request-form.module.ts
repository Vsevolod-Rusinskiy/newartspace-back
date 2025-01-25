import { Module } from '@nestjs/common'
import { RequestFormService } from './request-form.service'
import { RequestFormController } from './request-form.controller'

@Module({
  controllers: [RequestFormController],
  providers: [RequestFormService]
})
export class RequestFormModule {}
