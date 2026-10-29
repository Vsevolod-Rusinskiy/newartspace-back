import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { User } from './models/user.model'
import { SequelizeModule } from '@nestjs/sequelize'
import { MailModule } from 'src/mail/mail.module'

@Module({
  imports: [SequelizeModule.forFeature([User]), MailModule],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
