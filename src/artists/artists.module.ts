import { Module } from '@nestjs/common'
import { ArtistsService } from './artists.service'
import { ArtistsController } from './artists.controller'
import { SequelizeModule } from '@nestjs/sequelize'
import { Artist } from './models/artist.model'
import { StorageModule } from '../common/services/storage.module'
import { Painting } from '../paintings/models/painting.model'
import { AuthModule } from 'src/auth/auth.module'

@Module({
  imports: [
    SequelizeModule.forFeature([Artist, Painting]),
    StorageModule,
    AuthModule
  ],
  controllers: [ArtistsController],
  providers: [ArtistsService]
})
export class ArtistsModule {}
