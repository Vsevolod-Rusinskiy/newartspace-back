import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { User } from './models/user.model'
import { SequelizeModule } from '@nestjs/sequelize'
import { MailModule } from 'src/mail/mail.module'
import { UserPaintingsService } from './user-paintings.service'
import { UserPaintingsController } from './user-paintings.controller'
import { UserPainting } from './models/user-paintings.model'

@Module({
  imports: [SequelizeModule.forFeature([User, UserPainting]), MailModule],
  providers: [UsersService, UserPaintingsService],
  exports: [UsersService],
  controllers: [UserPaintingsController]
})
export class UsersModule {}
