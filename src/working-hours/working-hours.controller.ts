import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'

import { CreateWorkingHoursDto } from './dto/create-working-hours.dto'
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto'
import { WorkingHoursService } from './working-hours.service'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

@Controller('working-hours')
export class WorkingHoursController {
  constructor(
    private readonly workingHoursService: WorkingHoursService,
    private readonly cacheRevalidationPublisher: CacheRevalidationPublisher
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWorkingHoursDto: CreateWorkingHoursDto) {
    const workingHours = await this.workingHoursService.create(
      createWorkingHoursDto
    )
    this.cacheRevalidationPublisher.schedule({
      entity: 'working-hours',
      action: 'created',
      ids: [workingHours.id]
    })
    return workingHours
  }

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const safePage = page ? Number(page) : 1
    const safeLimit = limit ? Number(limit) : 10

    const { data, total } = await this.workingHoursService.findAll(
      safePage,
      safeLimit
    )
    return {
      data,
      total,
      page: safePage,
      pageCount: Math.ceil(total / safeLimit)
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const workingHours = await this.workingHoursService.findOne(id)
    return workingHours
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWorkingHoursDto: UpdateWorkingHoursDto
  ) {
    const workingHours = await this.workingHoursService.update(
      Number(id),
      updateWorkingHoursDto
    )
    this.cacheRevalidationPublisher.schedule({
      entity: 'working-hours',
      action: 'updated',
      ids: [id]
    })
    return workingHours
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.workingHoursService.delete(id)
    this.cacheRevalidationPublisher.schedule({
      entity: 'working-hours',
      action: 'deleted',
      ids: [id]
    })
    return { success: true }
  }
}
