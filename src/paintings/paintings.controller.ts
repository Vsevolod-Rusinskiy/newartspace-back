import { FileInterceptor } from '@nestjs/platform-express'

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
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
  private readonly logger = new Logger(PaintingsController.name)
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
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
  async getAllPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC'
  ) {
    let sortField = 'id'
    if (sort) {
      try {
        const parsedSort = JSON.parse(sort)
        if (Array.isArray(parsedSort) && parsedSort.length === 2) {
          sortField = parsedSort[0]
          order = parsedSort[1]
        }
      } catch (error) {
        console.error('Failed to parse sort parameter:', error)
      }
    }

    const data = await this.paintingService.findAll(sortField, order)
    return { data, total: data.length }
  }

  @Get(':id')
  getOnePainting(@Param('id') id: string) {
    return this.paintingService.findOne(id)
  }

  @Patch(':id')
  updatePainting(
    @Body() updatePainting: UpdatePaintingDto,
    @Param('id') id: string
  ) {
    return this.paintingService.update(+id, updatePainting)
  }

  @Delete(':id')
  deletePainting(@Param('id') id: string) {
    return this.paintingService.delete(id)
  }

  @Delete('deleteMany/:ids')
  deleteManyPaintings(@Param('ids') ids: string) {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    return this.paintingService.deleteMany(idArray)
  }
}
