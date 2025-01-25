import { Body, Controller, Post, Logger } from '@nestjs/common'
import { RequestFormService } from './request-form.service'
import { RequestFormDto } from './dto/request-form.dto'

@Controller('request-form')
export class RequestFormController {
  private readonly logger = new Logger(RequestFormController.name)

  constructor(private readonly requestFormService: RequestFormService) {}

  @Post('reproduction')
  async createOrder(@Body() requestFormDto: RequestFormDto) {
    const response = await this.requestFormService.sendOrder(requestFormDto)
    return { response }
  }
}
