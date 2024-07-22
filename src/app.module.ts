import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpErrorFilter } from './common/filtres/http-error.filter'
import { ConfigModule } from '@nestjs/config'
import { PaintingsModule } from './paintings/paintings.module'
import { SequelizeModule } from '@nestjs/sequelize'
import { SequelizeConfigService } from './config/sequelizeConfig.service'
import { databaseConfig } from './config/configuration'
import { StorageModule } from './common/services/storage.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useClass: SequelizeConfigService
    }),
    ConfigModule.forRoot({
      load: [databaseConfig]
    }),
    PaintingsModule,
    StorageModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter
    }
  ]
})
export class AppModule {}
