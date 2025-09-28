import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Sequelize, Op } from 'sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { Event } from './models/event.model'
import { EventPhoto } from './models/event-photo.model'
import { StorageService } from '../common/services/storage.service'
import { getFileNameFromUrl } from '../utils'

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(
    @InjectModel(Event)
    private eventModel: typeof Event,
    @InjectModel(EventPhoto)
    private eventPhotoModel: typeof EventPhoto,
    private readonly storageService: StorageService
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      const { eventPhotoIds, ...eventData } = createEventDto
      const event = new Event({
        ...eventData
      })
      await event.save()
      // Привязываем фото к событию
      if (eventPhotoIds && Array.isArray(eventPhotoIds)) {
        await this.eventPhotoModel.update(
          { eventId: event.id },
          { where: { id: eventPhotoIds } }
        )
      }
      return event
    } catch (error) {
      throw new InternalServerErrorException(
        `Error creating event: ${error.message}`
      )
    }
  }

  async getAllSortedEvents(
    sort?: string,
    order?: 'ASC' | 'DESC',
    page?: number,
    limit?: number,
    letter?: string
  ): Promise<{ data: Event[]; total: number }> {
    order = order || 'ASC'
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    let sortField = 'priority'
    if (sort) {
      try {
        const parsedSort = JSON.parse(sort)
        if (Array.isArray(parsedSort) && parsedSort.length === 2) {
          sortField = parsedSort[0]
          order = parsedSort[1]
        }
      } catch (error) {
        this.logger.error('Failed to parse sort parameter:', error)
      }
    }

    // Логика для определения порядка сортировки
    // Определяем порядок сортировки в зависимости от типа поля:

    let orderBy
    if (sortField === 'title') {
      orderBy = Sequelize.literal(`"title" COLLATE "POSIX"`)
    } else if (sortField === 'date') {
      orderBy = Sequelize.col('date')
    } else if (['id', 'priority'].includes(sortField)) {
      orderBy = Sequelize.col(`Event.${sortField}`)
    } else {
      orderBy = Sequelize.literal(`"Event"."${sortField}" COLLATE "POSIX"`)
    }

    const options: FindOptions = {
      where: {},
      order: [
        [Sequelize.col('priority'), 'DESC'],
        [orderBy, order]
      ],
      limit: limit,
      offset: (page - 1) * limit
    }

    // Добавляем условие для фильтрации по первой букве заголовка
    if (letter) {
      options.where = {
        ...options.where,
        title: {
          [Op.like]: `${letter}%`
        }
      }
    }

    const { rows: data, count: total } = await this.eventModel.findAndCountAll({
      ...options,
      distinct: true
    })

    return { data, total }
  }

  async findOne(id: string): Promise<Event> {
    // Find event with related photos
    const options: FindOptions = {
      where: { id },
      include: [{ model: EventPhoto, as: 'eventPhotos' }]
    }
    const event = await this.eventModel.findOne(options)
    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`)
    }
    return event
  }

  async update(id: number, event: UpdateEventDto): Promise<Event> {
    const existingEvent = await this.findOne(id.toString())
    if (!existingEvent) {
      throw new NotFoundException(`Event with id ${id} not found`)
    }
    // Check if image url changed
    if (existingEvent.imgUrl !== event.imgUrl) {
      // Remove old file if url changed
      const prevImgUrl = existingEvent.imgUrl
      const fileName = getFileNameFromUrl(prevImgUrl)
      await this.storageService.deleteFile(fileName, 'events')
    }
    const { eventPhotoIds, ...eventData } = event
    await this.eventModel.update(eventData, {
      where: { id },
      returning: true
    })
    // Unlink all photos from this event
    await this.eventPhotoModel.update(
      { eventId: null },
      { where: { eventId: id } }
    )
    // Link new photos
    if (eventPhotoIds && Array.isArray(eventPhotoIds)) {
      await this.eventPhotoModel.update(
        { eventId: id },
        { where: { id: eventPhotoIds } }
      )
    }
    // Return updated event with related photos
    return this.findOne(id.toString())
  }

  async delete(id: string): Promise<void> {
    const event = await this.findOne(id)

    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`)
    }

    const imgUrl = event.imgUrl
    const fileName = getFileNameFromUrl(imgUrl)

    try {
      await this.storageService.deleteFile(fileName, 'events')
      await event.destroy()
    } catch (error) {
      throw new InternalServerErrorException(
        `Error deleting event: ${error.message}`
      )
    }
  }

  async deleteMany(ids: string): Promise<{ deletedEventCount: number }> {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    let deletedEventCount = 0
    for (const id of idArray) {
      try {
        const event = await this.findOne(id)

        const imgUrl = event.imgUrl
        const fileName = getFileNameFromUrl(imgUrl)

        await this.storageService.deleteFile(fileName, 'events')
        await event.destroy()
        deletedEventCount++
      } catch (error) {
        throw new InternalServerErrorException(
          `Error deleting events: ${error.message}`
        )
      }
    }
    return { deletedEventCount }
  }
}
