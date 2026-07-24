import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { About } from './models/about.model'
import { StorageModule } from '../common/services/storage.module'
import { AboutService } from './about.service'
import { AboutController } from './about.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SequelizeModule.forFeature([About]), StorageModule, AuthModule],
  controllers: [AboutController],
  providers: [AboutService]
})
export class AboutModule {}
