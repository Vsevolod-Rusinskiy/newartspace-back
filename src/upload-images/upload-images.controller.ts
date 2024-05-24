import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { UploadImagesService } from './upload-images.service';

@Controller('uploads')
export class UploadImagesController {
  constructor(private readonly uploadImagesService: UploadImagesService) {}

  @Get('paintings/:id')
  async findOne(@Param('id') id: string, @Res() res: Response) {
    try {
      const fileBuffer = await this.uploadImagesService.findOne(id);
      if (!fileBuffer) {
        throw new NotFoundException(`File with id ${id} not found`);
      }
      res.setHeader('Content-Type', 'image/png');
      res.send(fileBuffer);
    } catch (error) {
      throw new NotFoundException(error.message);
    }
  }
}
