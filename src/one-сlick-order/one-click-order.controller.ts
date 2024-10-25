// src/one-click-order/one-click-order.controller.ts
import { Body, Controller, Post, Logger } from '@nestjs/common'
import { OneClickOrderService } from './one-click-order.service'
import { OneClickOrderDto } from './dto/one-click-order.dto'

@Controller('one-click-order')
export class OneClickOrderController {
  private readonly logger = new Logger(OneClickOrderController.name)

  constructor(private readonly oneClickOrderService: OneClickOrderService) {}

  @Post()
  async createOrder(@Body() oneClickOrderDto: OneClickOrderDto) {
    this.logger.log('Получен новый заказ: ' + JSON.stringify(oneClickOrderDto))
    await this.oneClickOrderService.sendOrder(oneClickOrderDto)
    return { message: 'Заказ успешно отправлен' }
  }
}
