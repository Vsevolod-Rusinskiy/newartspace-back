import { FileInterceptor } from '@nestjs/platform-express'

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'

import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { EventsService } from './events.service'
import { StorageService } from '../common/services/storage.service'

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly storageService: StorageService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  createEvent(@Body() createEvent: CreateEventDto) {
    return this.eventsService.create(createEvent)
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required')
    }

    const maxSizeInBytes = 1048576
    if (file.size > maxSizeInBytes) {
      throw new BadRequestException(
        'File size exceeds the maximum limit of 1 MB'
      )
    }

    const fileName = file.originalname
    const yandexImgUrl = await this.storageService.uploadFile(
      file.buffer,
      fileName,
      'events'
    )
    return {
      imgUrl: yandexImgUrl
    }
  }

  @Get()
  async getAllSortedArtists(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit,
    @Query('letter') letter
  ) {
    const { data, total } = await this.eventsService.getAllSortedEvents(
      sort,
      order,
      page,
      limit,
      letter
    )
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @Get(':id')
  async getOneEvent(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id)
    return event
  }

  @Patch(':id')
  async updateEvent(
    @Body() updateEvent: UpdateEventDto,
    @Param('id') id: string
  ) {
    const event = await this.eventsService.update(+id, updateEvent)
    return event
  }

  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'events')
    return { message: 'File deleted successfully' }
  }

  @Delete(':id')
  async deleteEvent(@Param('id') id: string) {
    await this.eventsService.delete(id)
    return { message: 'Event deleted successfully' }
  }

  @Delete('deleteMany/:ids')
  async deleteManyArtists(@Param('ids') ids: string) {
    const deletedCount = await this.eventsService.deleteMany(ids)
    return { message: 'Events deleted successfully', deletedCount }
  }
}
