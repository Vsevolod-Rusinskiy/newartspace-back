import { Body, Controller, Post, Logger } from '@nestjs/common'
import { RequestFormService } from './request-form.service'
import { RequestFormDto } from './dto/request-form.dto'

@Controller('request-form')
export class RequestFormController {
  private readonly logger = new Logger(RequestFormController.name)
  /* eslint-disable */
  constructor(private readonly requestFormService: RequestFormService) {}
  /* eslint-enable */

  @Post('reproduction')
  async createOrderReproduction(@Body() requestFormDto: RequestFormDto) {
    const response =
      await this.requestFormService.sendOrderReproduction(requestFormDto)
    return { response }
  }

  @Post('cart')
  async createOrderCart(@Body() requestFormDto: RequestFormDto) {
    const response = await this.requestFormService.sendOrderCart(requestFormDto)
    return { response }
  }
}
