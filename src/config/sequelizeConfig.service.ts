import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SequelizeModuleOptions,
  SequelizeOptionsFactory
} from '@nestjs/sequelize'
import { EnumConfig } from './enumConfig/enumConfig'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { Attributes } from '../attributes/models/attributes.model'
import { PaintingAttributes } from '../paintings/models/painting-attributes.model'
import { Event } from '../events/models/event.model'
import { User } from '../users/models/user.model'
import { Order } from '../orders/models/order.model'
import { OrderItem } from '../orders/models/order-item.model'
import { OrderStatus } from '../orders/models/order-status.model'
@Injectable()
export class SequelizeConfigService implements SequelizeOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createSequelizeOptions(): SequelizeModuleOptions {
    const {
      pg: { dialect, logging, host, port, username, password, database }
    } = this.configService.get(EnumConfig.DATABASE)

    return {
      dialect,
      logging,
      host,
      port,
      username,
      password,
      database,
      models: [
        Painting,
        Artist,
        Attributes,
        PaintingAttributes,
        Event,
        User,
        Order,
        OrderItem,
        OrderStatus
      ],
      autoLoadModels: true,
      synchronize: true
    }
  }
}
