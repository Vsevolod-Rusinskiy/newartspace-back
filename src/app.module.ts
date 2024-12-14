import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { HttpErrorFilter } from './common/filtres/http-error.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { ConfigModule } from '@nestjs/config'
import { PaintingsModule } from './paintings/paintings.module'
import { SequelizeModule } from '@nestjs/sequelize'
import { SequelizeConfigService } from './config/sequelizeConfig.service'
import { databaseConfig } from './config/configuration'
import { StorageModule } from './common/services/storage.module'
import { ValidationPipe } from '@nestjs/common'
import { ArtistsModule } from './artists/artists.module'
import { AppController } from './app.controller'
import { AttributesModule } from './attributes/attributes.module'
import { OneClickOrderModule } from './one-сlick-order/one-click-order.module'
import { EventsModule } from './events/events.module'
import { UsersModule } from './users/users.module'

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
    AttributesModule,
    ArtistsModule,
    PaintingsModule,
    EventsModule,
    StorageModule,
    OneClickOrderModule,
    UsersModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe
    }
  ],
  controllers: [AppController]
})
export class AppModule {}
