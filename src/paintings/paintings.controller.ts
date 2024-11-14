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

import { CreatePaintingDto } from './dto/create-painting.dto'
import { UpdatePaintingDto } from './dto/update-painting.dto'
import { PaintingsService } from './paintings.service'
import { StorageService } from '../common/services/storage.service'

@Controller('paintings')
export class PaintingsController {
  constructor(
    private readonly paintingService: PaintingsService,
    private readonly storageService: StorageService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  createPainting(@Body() createPainting: CreatePaintingDto) {
    return this.paintingService.create(createPainting)
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
      'paintings'
    )
    return {
      imgUrl: yandexImgUrl
    }
  }

  @Get()
  async getAllSortedPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit,
    @Query('filters') filters,
    @Query('artStyle') artStyle
  ) {
    const { data, total } = await this.paintingService.getAllSortedPaintings(
      sort,
      order,
      page,
      limit,
      filters,
      artStyle
    )
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @Get(':id')
  async getOnePainting(@Param('id') id: string) {
    const painting = await this.paintingService.findOne(id)
    return painting
  }

  @Patch(':id')
  async updatePainting(
    @Body() updatePainting: UpdatePaintingDto,
    // @Body() updatePainting,
    @Param('id') id: string
  ) {
    const painting = await this.paintingService.update(+id, updatePainting)
    return painting
  }

  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'paintings')
    return { message: 'File deleted successfully' }
  }

  @Delete(':id')
  async deletePainting(@Param('id') id: string) {
    await this.paintingService.delete(id)
    return { message: 'Painting deleted successfully' }
  }

  @Delete('deleteMany/:ids')
  async deleteManyPaintings(@Param('ids') ids: string) {
    const deletedCount = await this.paintingService.deleteMany(ids)
    return { message: 'Paintings deleted successfully', deletedCount }
  }
}
