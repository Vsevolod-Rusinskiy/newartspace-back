import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { Event } from './models/event.model'
import { StorageModule } from '../common/services/storage.module'
import { EventsService } from './events.service'
import { EventsController } from './events.controller'
import { AuthModule } from 'src/auth/auth.module'

@Module({
  imports: [SequelizeModule.forFeature([Event]), StorageModule, AuthModule],
  controllers: [EventsController],
  providers: [EventsService]
})
export class EventsModule {}
