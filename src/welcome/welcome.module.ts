import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { WelcomeController } from './welcome.controller'
import { WelcomeService } from './welcome.service'
import { Welcomes } from './models/welcome.model'

@Module({
  imports: [SequelizeModule.forFeature([Welcomes])],
  controllers: [WelcomeController],
  providers: [WelcomeService]
})
export class WelcomeModule {}
