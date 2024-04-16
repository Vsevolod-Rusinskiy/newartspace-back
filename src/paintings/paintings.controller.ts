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
} from '@nestjs/common';

import { CreatePaintingDto } from './dto/create-painting.dto';
import { UpdatePaintingDto } from './dto/update-painting.dto';
import { PaintingsService } from './paintings.service';

// todo: Dany !!! Are we going to use swagger?

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
}
