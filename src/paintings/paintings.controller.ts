import { FileInterceptor } from '@nestjs/platform-express';

import {
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
  UseInterceptors,
} from '@nestjs/common';

import { CreatePaintingDto } from './dto/create-painting.dto';
import { UpdatePaintingDto } from './dto/update-painting.dto';
import { PaintingsService } from './paintings.service';
import { storage } from '../config/multerConfig';

@Controller('paintings')
export class PaintingsController {
  constructor(private readonly paintingService: PaintingsService) {}

  @Get()
  async getAllPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
  ) {
    // Логирование параметров для отладки
    console.log(`Received sort: ${sort}, order: ${order}`);

    // Разбор параметра sort, если он представляет собой массив
    let sortField = 'id'; // Значение по умолчанию
    if (sort) {
      try {
        const parsedSort = JSON.parse(sort);
        if (Array.isArray(parsedSort) && parsedSort.length === 2) {
          sortField = parsedSort[0];
          order = parsedSort[1];
        }
      } catch (error) {
        console.error('Failed to parse sort parameter:', error);
      }
    }

    const data = await this.paintingService.findAll(sortField, order);
    return { data, total: data.length };
  }

  @Get(':id')
  getOnePainting(@Param('id') id: string) {
    return this.paintingService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  createPainting(@Body() createPainting: CreatePaintingDto) {
    return this.paintingService.create(createPainting);
  }

  @Patch(':id')
  updatePainting(
    @Body() updatePainting: UpdatePaintingDto,
    @Param('id') id: string,
  ) {
    return this.paintingService.update(+id, updatePainting);
  }

  @Delete(':id')
  deletePainting(@Param('id') id: string) {
    return this.paintingService.delete(id);
  }

  @Delete('deleteMany/:ids')
  deleteManyPaintings(@Param('ids') ids: string) {
    const idArray = JSON.parse(ids).map((id) => id.toString());
    return this.paintingService.deleteMany(idArray);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return {
      id: file.filename.split('.')[0],
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
    };
  }
}
