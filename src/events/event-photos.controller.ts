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
  findAll() {
    return this.eventPhotosService.findAll()
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

    const maxSizeInBytes = 1048576 // 1 MB
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
}
