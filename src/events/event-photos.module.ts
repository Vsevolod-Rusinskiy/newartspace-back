import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { EventPhoto } from './models/event-photo.model'
import { StorageModule } from '../common/services/storage.module'
import { EventPhotosService } from './event-photos.service'
import { EventPhotosController } from './event-photos.controller'
import { AuthModule } from 'src/auth/auth.module'

@Module({
  imports: [
    SequelizeModule.forFeature([EventPhoto]),
    StorageModule,
    AuthModule
  ],
  controllers: [EventPhotosController],
  providers: [EventPhotosService],
  exports: [EventPhotosService]
})
export class EventPhotosModule {}
