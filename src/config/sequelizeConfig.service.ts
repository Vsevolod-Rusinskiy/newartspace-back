import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SequelizeModuleOptions,
  SequelizeOptionsFactory
} from '@nestjs/sequelize'
import { EnumConfig } from './enumConfig/enumConfig'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'

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
      models: [Painting, Artist],
      autoLoadModels: true,
      synchronize: true
    }
  }
}
