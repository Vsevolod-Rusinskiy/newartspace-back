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

  // todo - check storage
  // todo - make thin
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required')
    }
    const fileName = file.originalname
    const yandexPaintingUrl = await this.storageService.uploadFile(
      file.buffer,
      fileName,
      'paintings'
    )
    return {
      paintingUrl: yandexPaintingUrl
    }
  }

  @Get()
  async getAllSortedPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC'
  ) {
    const data = await this.paintingService.getAllSortedPaintings(sort, order)
    return { data, total: data.length }
  }

  @Get(':id')
  async getOnePainting(@Param('id') id: string) {
    const painting = await this.paintingService.findOne(id)
    console.log('Updated painting:', painting)
    return painting
  }

  @Patch(':id')
  async updatePainting(
    @Body() updatePainting: UpdatePaintingDto,
    @Param('id') id: string
  ) {
    const painting = await this.paintingService.update(+id, updatePainting)
    console.log('Updated painting:', painting)
    return painting
  }

  @Delete(':id')
  async deletePainting(@Param('id') id: string) {
    await this.paintingService.delete(id)
    return { message: 'Painting deleted successfully' }
  }

  @Delete('deleteMany/:ids')
  async deleteManyPaintings(@Param('ids') ids: string) {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    const deletedCount = await this.paintingService.deleteMany(idArray)
    return { message: 'Paintings deleted successfully', deletedCount }
  }
}
