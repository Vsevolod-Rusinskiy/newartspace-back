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
import { StorageService } from '../common/services/storage.service'
import { getFileNameFromUrl } from '../utils'

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(
    @InjectModel(Event)
    private eventModel: typeof Event,
    private readonly storageService: StorageService
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      const event = new Event({
        ...createEventDto
      })
      await event.save()
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

    this.logger.debug(
      `Sort: ${sort}, Order: ${order}, Page: ${page}, Limit: ${limit}`
    )

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

    this.logger.debug(sortField)

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
    const options: FindOptions = {
      where: { id }
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
    // Проверяем, изменился ли URL картинки
    if (existingEvent.imgUrl !== event.imgUrl) {
      // Удаляем старый файл, если URL изменился
      const prevImgUrl = existingEvent.imgUrl
      const fileName = getFileNameFromUrl(prevImgUrl)
      await this.storageService.deleteFile(fileName, 'events')
    }

    const data = await this.eventModel.update(event, {
      where: { id },
      returning: true
    })

    return data[1][0]
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
