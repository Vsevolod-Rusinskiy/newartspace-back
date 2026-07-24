import { InjectModel } from '@nestjs/sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreateAboutDto } from './dto/create-about.dto'
import { UpdateAboutDto } from './dto/update-about.dto'
import { About } from './models/about.model'
import { StorageService } from '../common/services/storage.service'
import { getFileNameFromUrl } from '../utils'

@Injectable()
export class AboutService {
  private readonly logger = new Logger(AboutService.name)

  constructor(
    @InjectModel(About)
    private aboutModel: typeof About,
    private readonly storageService: StorageService
  ) {}

  async create(createAboutDto: CreateAboutDto): Promise<About> {
    try {
      const about = new About({ ...createAboutDto })
      await about.save()
      return about
    } catch (error) {
      this.logger.error(`Error creating about page: ${error.message}`)
      throw new InternalServerErrorException(
        `Error creating about page: ${error.message}`
      )
    }
  }

  async findAll(
    page?: number,
    limit?: number
  ): Promise<{ data: About[]; total: number }> {
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    const { rows: data, count: total } = await this.aboutModel.findAndCountAll({
      order: [['id', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit,
      distinct: true
    })

    return { data, total }
  }

  async findOne(id: string): Promise<About> {
    const about = await this.aboutModel.findOne({
      where: { id: Number(id) }
    })

    if (!about) {
      throw new NotFoundException(`About page with id ${id} not found`)
    }

    return about
  }

  async update(id: number, updateAboutDto: UpdateAboutDto): Promise<About> {
    const about = await this.findOne(id.toString())
    if (!about) {
      throw new NotFoundException(`About page with id ${id} not found`)
    }

    if (updateAboutDto.imgUrl && about.imgUrl !== updateAboutDto.imgUrl) {
      const prevImgUrl = about.imgUrl
      if (prevImgUrl) {
        const fileName = getFileNameFromUrl(prevImgUrl)
        await this.storageService.deleteFile(fileName, 'about')
      }
    }

    const [, [updatedAbout]] = await this.aboutModel.update(updateAboutDto, {
      where: { id },
      returning: true
    })

    return updatedAbout
  }

  async delete(id: string): Promise<void> {
    const about = await this.findOne(id)
    if (!about) {
      throw new NotFoundException(`About page with id ${id} not found`)
    }

    try {
      if (about.imgUrl) {
        const fileName = getFileNameFromUrl(about.imgUrl)
        await this.storageService.deleteFile(fileName, 'about')
      }
      await about.destroy()
    } catch (error) {
      this.logger.error(`Error deleting about page: ${error.message}`)
      throw new InternalServerErrorException(
        `Error deleting about page: ${error.message}`
      )
    }
  }
}
