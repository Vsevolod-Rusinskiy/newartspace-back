import { FileInterceptor } from '@nestjs/platform-express'
import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'

import { CreateEventPhotoDto } from './dto/create-event-photo.dto'
import { UpdateEventPhotoDto } from './dto/update-event-photo.dto'
import { EventPhotosService } from './event-photos.service'
import { StorageService } from '../common/services/storage.service'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'

@Controller('event-photos')
export class EventPhotosController {
  constructor(
    private readonly eventPhotosService: EventPhotosService,
    private readonly storageService: StorageService
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createEventPhotoDto: CreateEventPhotoDto) {
    const photo = await this.eventPhotosService.create(createEventPhotoDto)
    return photo
  }

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    // Делаем значения по умолчанию, если не переданы
    const safePage = page ? Number(page) : 1
    const safeLimit = limit ? Number(limit) : 1000 // или другое подходящее значение

    const { data, total } = await this.eventPhotosService.findAll(
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
    const photo = await this.eventPhotosService.findOne(id)
    return photo
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventPhotoDto: UpdateEventPhotoDto
  ) {
    const photo = await this.eventPhotosService.update(
      Number(id),
      updateEventPhotoDto
    )
    return photo
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.eventPhotosService.delete(id)
    return { success: true }
  }

  @UseGuards(AdminJwtGuard)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required')
    }

    await this.validateFileSize(file)

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

  async validateFileSize(file: Express.Multer.File) {
    const imageMaxSize = 1 * 1024 * 1024 // 1 MB
    const videoMaxSize = 5 * 1024 * 1024 // 5 MB

    if (file) {
      const isImage = file.mimetype.startsWith('image/')
      const isVideo = file.mimetype.startsWith('video/')

      if (isImage && file.size > imageMaxSize) {
        throw new BadRequestException(
          'Размер изображения должен быть не более 1MB'
        )
      }

      if (isVideo && file.size > videoMaxSize) {
        throw new BadRequestException('Размер видео должен быть не более 5MB')
      }
    }
  }
}
