import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Patch,
  Delete,
  UseGuards
} from '@nestjs/common'
import { WelcomeService } from './welcome.service'
import { CreateWelcomeDto } from './dto/create-welcome.dto'
import { UpdateWelcomeDto } from './dto/update-welcome.dto'
import { Welcomes } from './models/welcome.model'
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard'

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

  @Get(':id')
  async getOneWelcome(@Param('id') id: string) {
    const welcome = await this.welcomeService.findOne(id)
    return welcome
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async updateWelcome(
    @Body() updateWelcome: UpdateWelcomeDto,
    @Param('id') id: string
  ) {
    const welcome = await this.welcomeService.update(+id, updateWelcome)
    return welcome
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async deleteWelcome(@Param('id') id: string) {
    await this.welcomeService.delete(id)
    return { message: 'Welcome deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete('deleteMany/:ids')
  async deleteManyWelcomes(@Param('ids') ids: string) {
    const deletedCount = await this.welcomeService.deleteMany(ids)
    return { message: 'Welcomes deleted successfully', deletedCount }
  }
}
