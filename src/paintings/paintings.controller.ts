import { FileInterceptor } from '@nestjs/platform-express';

import {
  Bind,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

// todo: Dany !!! Are we going to use swagger?
import { CreatePaintingDto } from './dto/create-painting.dto';
import { UpdatePaintingDto } from './dto/update-painting.dto';
import { PaintingsService } from './paintings.service';

@Controller('paintings')
export class PaintingsController {
  constructor(private readonly paintingService: PaintingsService) {}

  @Get()
  getAllPaintings() {
    return this.paintingService.findAll();
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
    const idArray = JSON.parse(ids);
    return this.paintingService.deleteMany(idArray);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log(file);
  }
}
