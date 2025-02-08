import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Logger,
  Query,
  Delete
} from '@nestjs/common'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { Order } from './models/order.model'
import { OrderStatus } from './models/order-status.model'
import { UpdateOrderDto } from './dto/update-order.dto'

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

  @Get('getMany/:ids')
  async getMany(@Param('ids') ids: string) {
    return this.ordersService.getMany(ids)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto
  ): Promise<Order> {
    this.logger.log(`Updating order ${id}`)
    return this.ordersService.update(+id, updateOrderDto)
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting order ${id}`)
    return this.ordersService.delete(+id)
  }

  @Delete('deleteMany/:ids')
  async deleteMany(@Param('ids') ids: string) {
    this.logger.log(`Deleting orders with ids: ${ids}`)
    return this.ordersService.deleteMany(ids)
  }

  @Get('statuses/list')
  async getStatuses(): Promise<OrderStatus[]> {
    return this.ordersService.getStatuses()
  }

  @Get()
  async findAll(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC',
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('filter') filter: string
  ) {
    return this.ordersService.findAll(sort, order, page, limit, filter)
  }

  @Delete(':orderId/items')
  async deleteItems(
    @Param('orderId') orderId: string,
    @Body() dto: { itemIds: number[] }
  ) {
    this.logger.debug(
      `Request to delete items. OrderId: ${orderId}, Body: ${JSON.stringify(dto)}`
    )
    this.logger.debug(
      `ItemIds type: ${typeof dto.itemIds}, Value: ${dto.itemIds}`
    )
    return this.ordersService.deleteItems(+orderId, dto.itemIds)
  }
}
