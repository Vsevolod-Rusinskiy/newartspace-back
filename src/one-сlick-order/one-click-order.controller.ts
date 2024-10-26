import { Body, Controller, Post, Logger } from '@nestjs/common'
import { OneClickOrderService } from './one-click-order.service'
import { OneClickOrderDto } from './dto/one-click-order.dto'

@Controller('one-click-order')
export class OneClickOrderController {
  private readonly logger = new Logger(OneClickOrderController.name)

  constructor(private readonly oneClickOrderService: OneClickOrderService) {}

  @Post()
  async createOrder(@Body() oneClickOrderDto: OneClickOrderDto) {
    const response = await this.oneClickOrderService.sendOrder(oneClickOrderDto)
    return { response }
  }
}
