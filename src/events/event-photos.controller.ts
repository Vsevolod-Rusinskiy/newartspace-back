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
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'

import { CreateEventPhotoDto } from './dto/create-event-photo.dto'
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
  create(@Body() createEventPhotoDto: CreateEventPhotoDto) {
    return this.eventPhotosService.create(createEventPhotoDto)
  }

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const { data, total } = await this.eventPhotosService.findAll(page, limit)
    return {
      data,
      total,
      page,
      pageCount: Math.ceil(total / limit)
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventPhotosService.findOne(id)
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventPhotosService.delete(id)
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
