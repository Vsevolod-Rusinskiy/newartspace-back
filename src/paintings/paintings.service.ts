import { InjectModel } from '@nestjs/sequelize'
import { FindOptions } from 'sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreatePaintingDto } from './dto/create-painting.dto'
import { UpdatePaintingDto } from './dto/update-painting.dto'
import { Painting } from './models/painting.model'
import { StorageService } from '../common/services/storage.service'

function getFileNameFromUrl(url: string): string {
  return url.substring(url.lastIndexOf('/') + 1)
}

@Injectable()
export class PaintingsService {
  private readonly logger = new Logger(PaintingsService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private readonly storageService: StorageService
  ) {}

  async create(createPaintingDto: CreatePaintingDto): Promise<Painting> {
    try {
      const painting = new Painting({
        ...createPaintingDto
      })
      await painting.save()
      return painting
    } catch (error) {
      throw new InternalServerErrorException(
        `Error creating painting: ${error.message}`
      )
    }
  }

  async findAll(
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<Painting[]> {
    const options: FindOptions = {
      order: [[sort, order]]
    }

    return this.paintingModel.findAll(options)
  }

  async findOne(id: string): Promise<Painting> {
    const options: FindOptions = {
      where: { id }
    }
    const painting = await this.paintingModel.findOne(options)
    if (!painting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }
    return painting
  }

  async update(
    id: number,
    painting: UpdatePaintingDto
  ): Promise<[number, Painting[]]> {
    const prevPaintingUrl = painting.prevPaintingUrl
    const fileName = getFileNameFromUrl(prevPaintingUrl)

    await this.storageService.deleteFile(fileName, 'paintings')

    return this.paintingModel.update(painting, {
      where: { id },
      returning: true
    })
  }

  async delete(id: string): Promise<void> {
    const painting = await this.findOne(id)

    const paintingUrl = painting.paintingUrl
    const fileName = getFileNameFromUrl(paintingUrl)

    await this.storageService.deleteFile(fileName, 'paintings')
    await painting.destroy()
  }

  async deleteMany(ids: string[]): Promise<{ deletedPaintingCount: number }> {
    const deletedPaintingCount = 0
    for (const id of ids) {
      const painting = await this.findOne(id)

      const paintingUrl = painting.dataValues.paintingUrl
      const fileName = getFileNameFromUrl(paintingUrl)

      await this.storageService.deleteFile(fileName, 'paintings')
      await painting.destroy()
    }
    return { deletedPaintingCount }
  }
}
