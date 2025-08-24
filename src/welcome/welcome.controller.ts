import { Controller, Get, Post, Body } from '@nestjs/common'
import { WelcomeService } from './welcome.service'
import { CreateWelcomeDto } from './dto/create-welcome.dto'
import { Welcomes } from './models/welcome.model'

@Controller('welcome')
export class WelcomeController {
  constructor(private readonly welcomeService: WelcomeService) {}

  @Post()
  create(@Body() createWelcomeDto: CreateWelcomeDto): Promise<Welcomes> {
    return this.welcomeService.create(createWelcomeDto)
  }

  @Get()
  findAll(): Promise<Welcomes[]> {
    return this.welcomeService.findAll()
  }
}
