import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { Event } from './models/event.model'
import { StorageModule } from '../common/services/storage.module'
import { EventsService } from './events.service'
import { EventsController } from './events.controller'

@Module({
  imports: [SequelizeModule.forFeature([Event]), StorageModule],
  controllers: [EventsController],
  providers: [EventsService]
})
export class EventsModule {}
