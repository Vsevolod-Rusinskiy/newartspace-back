import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { AuthModule } from '../auth/auth.module'
import { Painting } from '../paintings/models/painting.model'
import { UserPainting } from './models/user-paintings.model'
import { UserPaintingsController } from './user-paintings.controller'
import { UserPaintingsOwnerGuard } from './user-paintings-owner.guard'
import { UserPaintingsService } from './user-paintings.service'
import { UsersModule } from './users.module'

@Module({
  imports: [
    AuthModule,
    UsersModule,
    SequelizeModule.forFeature([UserPainting, Painting])
  ],
  providers: [UserPaintingsService, UserPaintingsOwnerGuard],
  controllers: [UserPaintingsController]
})
export class UserPaintingsModule {}
