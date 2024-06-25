import * as fs from 'fs/promises'
import * as path from 'path'
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common'

// Если файл существует, возвращает его содержимое
@Injectable()
export class UploadImagesService {
  private readonly uploadPath = path.join(__dirname, '../../uploads/paintings')

  async findOne(id: string): Promise<Buffer> {
    const filePath = path.join(this.uploadPath, id)

    try {
      return await fs.readFile(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException(`File with id ${id} not found`)
      } else {
        throw new InternalServerErrorException(
          `Error reading file: ${error.message}`,
        )
      }
    }
  }
}
