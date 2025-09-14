import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { Event } from './models/event.model'
import { StorageModule } from '../common/services/storage.module'
import { EventsService } from './events.service'
import { EventsController } from './events.controller'
import { AuthModule } from 'src/auth/auth.module'
import { EventPhoto } from './models/event-photo.model'

@Module({
  imports: [
    SequelizeModule.forFeature([Event, EventPhoto]),
    StorageModule,
    AuthModule
  ],
  controllers: [EventsController],
  providers: [EventsService]
})
export class EventsModule {}
/* eslint-disable */
