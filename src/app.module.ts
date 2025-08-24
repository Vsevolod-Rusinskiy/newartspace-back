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
import { RequestFormModule } from './request-form/request-form.module'
import { EventsModule } from './events/events.module'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { ProfileModule } from './profile/profile.module'
import { MailModule } from './mail/mail.module'
import { OrdersModule } from './orders/orders.module'
import { WelcomeModule } from './welcome/welcome.module'

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
    RequestFormModule,
    UsersModule,
    AuthModule,
    ProfileModule,
    MailModule,
    OrdersModule,
    WelcomeModule
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
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        validateCustomDecorators: true,
        transformOptions: { enableImplicitConversion: true }
      })
    }
  ],
  controllers: [AppController]
})
/* eslint-disable */
export class AppModule {}
