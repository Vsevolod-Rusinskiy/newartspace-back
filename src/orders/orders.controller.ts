import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Logger
} from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { Order } from './models/order.model'
import { OrderStatus } from './models/order-status.model'

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name)

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    this.logger.log(
      `Creating order for customer: ${createOrderDto.customerName}`
    )
    return this.ordersService.create(createOrderDto)
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Order> {
    return this.ordersService.findOne(+id)
  }

  @Patch(':id/status/:statusId')
  async updateStatus(
    @Param('id') id: string,
    @Param('statusId') statusId: string
  ): Promise<Order> {
    this.logger.log(`Updating order ${id} status to ${statusId}`)
    return this.ordersService.updateStatus(+id, +statusId)
  }

  @Get('statuses/list')
  async getStatuses(): Promise<OrderStatus[]> {
    return this.ordersService.getStatuses()
  }
}
