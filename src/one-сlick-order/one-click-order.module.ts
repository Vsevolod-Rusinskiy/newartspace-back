import { Module } from '@nestjs/common'
import { OneClickOrderService } from './one-click-order.service'
import { OneClickOrderController } from './one-click-order.controller'

@Module({
  controllers: [OneClickOrderController],
  providers: [OneClickOrderService]
})
export class OneClickOrderModule {}
