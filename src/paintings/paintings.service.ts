import * as path from 'path'
import * as fs from 'fs/promises'
import { InjectModel } from '@nestjs/sequelize'
import { FindOptions } from 'sequelize'
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { CreatePaintingDto } from './dto/create-painting.dto'
import { UpdatePaintingDto } from './dto/update-painting.dto'
import { Painting } from './models/painting.model'

@Injectable()
export class PaintingsService {
  private readonly uploadPath = path.join(__dirname, '../../uploads/paintings')

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
  ) {}

  private getPaintingFileName(url: string): string {
    return path.basename(url)
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException(`File not found at path: ${filePath}`)
      } else {
        throw new InternalServerErrorException(
          `Error deleting file: ${error.message}`,
        )
      }
    }
  }

  async findAll(
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Painting[]> {
    const options: FindOptions = {
      order: [[sort, order]],
    }

    return this.paintingModel.findAll(options)
  }

  async findOne(id: string): Promise<Painting> {
    const options: FindOptions = {
      where: { id },
    }
    const painting = await this.paintingModel.findOne(options)
    if (!painting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }
    return painting
  }

  async create(createPainting: CreatePaintingDto): Promise<Painting> {
    const painting = new Painting()

    painting.author = createPainting.author
    painting.paintingUrl = createPainting.paintingUrl
    painting.title = createPainting.title
    painting.artType = createPainting.artType
    painting.price = createPainting.price
    painting.theme = createPainting.theme
    painting.style = createPainting.style
    painting.base = createPainting.base
    painting.materials = createPainting.materials
    painting.height = createPainting.height
    painting.width = createPainting.width
    painting.yearOfCreation = createPainting.yearOfCreation
    painting.format = createPainting.format
    painting.color = createPainting.color

    return painting.save()
  }

  async update(
    id: number,
    painting: UpdatePaintingDto,
  ): Promise<[number, Painting[]]> {
    if (painting.prevPaintingUrl) {
      const paintingFileName = this.getPaintingFileName(
        painting.prevPaintingUrl,
      )
      const filePath = path.join(this.uploadPath, paintingFileName)
      await this.deleteFile(filePath)
    }

    return this.paintingModel.update(painting, {
      where: { id },
      returning: true,
    })
  }

  async delete(id: string): Promise<void> {
    const painting = await this.findOne(id)
    const paintingFileName = this.getPaintingFileName(painting.paintingUrl)
    const filePath = path.join(this.uploadPath, paintingFileName)
    await this.deleteFile(filePath)
    await painting.destroy()
  }

  async deleteMany(ids: string[]): Promise<{ deletedPaintingCount: number }> {
    let deletedPaintingCount = 0
    for (const id of ids) {
      const painting = await this.findOne(id)
      const paintingFileName = this.getPaintingFileName(painting.paintingUrl)
      const filePath = path.join(this.uploadPath, paintingFileName)
      await this.deleteFile(filePath)
      await painting.destroy()
      deletedPaintingCount++
    }

    return { deletedPaintingCount }
  }
}
