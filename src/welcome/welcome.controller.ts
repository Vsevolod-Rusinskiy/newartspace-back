import { Controller, Get, Post, Body, Query } from '@nestjs/common'
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
  async getAllSortedWelcomes(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'DESC',
    @Query('page') page,
    @Query('limit') limit
  ) {
    const { data, total } = await this.welcomeService.getAllSortedWelcomes(
      sort,
      order,
      page,
      limit
    )
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }
}
