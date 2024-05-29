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
      res.setHeader('Content-Type', 'image/*');
      res.send(fileBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).send({ message: error.message });
      } else {
        res.status(500).send({ message: 'Internal server error' });
      }
    }
  }
}
