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

import { CreateAboutDto } from './dto/create-about.dto'
import { UpdateAboutDto } from './dto/update-about.dto'
import { AboutService } from './about.service'
import { StorageService } from '../common/services/storage.service'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

@Controller('about')
export class AboutController {
  constructor(
    private readonly aboutService: AboutService,
    private readonly storageService: StorageService,
    private readonly cacheRevalidationPublisher: CacheRevalidationPublisher
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAboutDto: CreateAboutDto) {
    const about = await this.aboutService.create(createAboutDto)
    this.cacheRevalidationPublisher.schedule({
      entity: 'about',
      action: 'created',
      ids: [about.id]
    })
    return about
  }

  @UseGuards(AdminJwtGuard)
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
      'about'
    )
    return {
      imgUrl: yandexImgUrl
    }
  }

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const safePage = page ? Number(page) : 1
    const safeLimit = limit ? Number(limit) : 10

    const { data, total } = await this.aboutService.findAll(safePage, safeLimit)
    return {
      data,
      total,
      page: safePage,
      pageCount: Math.ceil(total / safeLimit)
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const about = await this.aboutService.findOne(id)
    return about
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAboutDto: UpdateAboutDto
  ) {
    const about = await this.aboutService.update(Number(id), updateAboutDto)
    this.cacheRevalidationPublisher.schedule({
      entity: 'about',
      action: 'updated',
      ids: [id]
    })
    return about
  }

  @UseGuards(AdminJwtGuard)
  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'about')
    return { message: 'File deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.aboutService.delete(id)
    this.cacheRevalidationPublisher.schedule({
      entity: 'about',
      action: 'deleted',
      ids: [id]
    })
    return { success: true }
  }
}
