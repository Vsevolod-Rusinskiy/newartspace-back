import { InjectModel } from '@nestjs/sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreateEventPhotoDto } from './dto/create-event-photo.dto'
import { EventPhoto } from './models/event-photo.model'
import { StorageService } from '../common/services/storage.service'
import { getFileNameFromUrl } from '../utils'

@Injectable()
export class EventPhotosService {
  private readonly logger = new Logger(EventPhotosService.name)

  constructor(
    @InjectModel(EventPhoto)
    private eventPhotoModel: typeof EventPhoto,
    private readonly storageService: StorageService
  ) {}

  async create(createEventPhotoDto: CreateEventPhotoDto): Promise<EventPhoto> {
    try {
      const eventPhoto = new EventPhoto({
        ...createEventPhotoDto,
        priority: createEventPhotoDto.priority || 0
      })
      await eventPhoto.save()
      return eventPhoto
    } catch (error) {
      this.logger.error(`Error creating event photo: ${error.message}`)
      throw new InternalServerErrorException(
        `Error creating event photo: ${error.message}`
      )
    }
  }

  async findAll(
    page?: number,
    limit?: number
  ): Promise<{ data: EventPhoto[]; total: number }> {
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    const { rows: data, count: total } =
      await this.eventPhotoModel.findAndCountAll({
        order: [['priority', 'DESC']],
        limit: limit,
        offset: (page - 1) * limit,
        distinct: true
      })

    return { data, total }
  }

  async findOne(id: string): Promise<EventPhoto> {
    const eventPhoto = await this.eventPhotoModel.findOne({
      where: { id }
    })

    if (!eventPhoto) {
      throw new NotFoundException(`Event photo with id ${id} not found`)
    }

    return eventPhoto
  }

  async update(
    id: number,
    updateEventPhotoDto: UpdateEventPhotoDto
  ): Promise<{ data: EventPhoto }> {
    const eventPhoto = await this.findOne(id.toString())
    if (!eventPhoto) {
      throw new NotFoundException(`Event photo with id ${id} not found`)
    }

    // Если меняется URL картинки, удаляем старый файл
    if (
      updateEventPhotoDto.imgUrl &&
      eventPhoto.imgUrl !== updateEventPhotoDto.imgUrl
    ) {
      const prevImgUrl = eventPhoto.imgUrl
      const fileName = getFileNameFromUrl(prevImgUrl)
      await this.storageService.deleteFile(fileName, 'events')
    }

    const [, [updatedPhoto]] = await this.eventPhotoModel.update(
      updateEventPhotoDto,
      {
        where: { id },
        returning: true
      }
    )

    return { data: updatedPhoto }
  }

  async delete(id: string): Promise<void> {
    const eventPhoto = await this.findOne(id)
    if (!eventPhoto) {
      throw new NotFoundException(`Event photo with id ${id} not found`)
    }

    try {
      // Удаляем файл из хранилища
      const fileName = getFileNameFromUrl(eventPhoto.imgUrl)
      await this.storageService.deleteFile(fileName, 'events')

      // Удаляем запись из БД
      await eventPhoto.destroy()
    } catch (error) {
      this.logger.error(`Error deleting event photo: ${error.message}`)
      throw new InternalServerErrorException(
        `Error deleting event photo: ${error.message}`
      )
    }
  }
}
