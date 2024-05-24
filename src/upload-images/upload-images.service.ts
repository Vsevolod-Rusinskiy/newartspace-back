import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UploadImagesService {
  private readonly uploadPath = path.join(__dirname, '../../uploads/paintings');

  async findOne(id: string): Promise<Buffer> {
    const filePath = path.join(this.uploadPath, id);

    try {
      if (fs.existsSync(filePath)) {
        return fs.promises.readFile(filePath);
      } else {
        throw new NotFoundException(`File with id ${id} not found`);
      }
    } catch (error) {
      throw new NotFoundException(`Error reading file: ${error.message}`);
    }
  }
}
