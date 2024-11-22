import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Sequelize, Op } from 'sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreateArtistDto } from './dto/create-artist.dto'
import { UpdateArtistDto } from './dto/update-artist.dto'
import { Artist } from './models/artist.model'
import { StorageService } from '../common/services/storage.service'
import { getFileNameFromUrl } from '../utils'
import { Painting } from '../paintings/models/painting.model'

@Injectable()
export class ArtistsService {
  private readonly logger = new Logger(ArtistsService.name)

  constructor(
    @InjectModel(Artist)
    private artistModel: typeof Artist,
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private readonly storageService: StorageService
  ) {}

  async create(createArtistDto: CreateArtistDto): Promise<Artist> {
    try {
      const artist = new Artist({
        ...createArtistDto
      })
      await artist.save()
      return artist
    } catch (error) {
      throw new InternalServerErrorException(
        `Error creating artist: ${error.message}`
      )
    }
  }

  async getAllSortedArtists(
    sort?: string,
    order?: 'ASC' | 'DESC',
    page?: number,
    limit?: number,
    letter?: string
  ): Promise<{ data: Artist[]; total: number }> {
    order = order || 'ASC'
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    this.logger.debug(
      `Sort: ${sort}, Order: ${order}, Page: ${page}, Limit: ${limit}`
    )

    let sortField = 'id'
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
    // 1. Для имени художника используем COLLATE для регистронезависимой сортировки.
    // 2. Для числового поля priority и id используем стандартную сортировку без COLLATE.
    // 3. Для остальных строковых полей применяем COLLATE для регистронезависимой сортировки.
    let orderBy
    if (sortField === 'artistName') {
      orderBy = Sequelize.literal(`"artistName" COLLATE "POSIX"`)
    } else if (['id', 'priority'].includes(sortField)) {
      orderBy = Sequelize.col('priority')
    } else {
      orderBy = Sequelize.literal(`"${sortField}" COLLATE "POSIX"`)
    }

    const options: FindOptions = {
      where: {},
      order: [
        [Sequelize.col('priority'), 'DESC'],
        [orderBy, order]
      ],
      limit: limit,
      offset: (page - 1) * limit,
      include: [
        {
          model: this.paintingModel,
          as: 'paintings'
        }
      ]
    }

    // Добавляем условие для фильтрации по первой букве имени художника
    if (letter) {
      options.where = {
        ...options.where,
        artistName: {
          [Op.like]: `${letter}%`
        }
      }
    }

    const { rows: data, count: total } = await this.artistModel.findAndCountAll(
      {
        ...options,
        distinct: true
      }
    )

    return { data, total }
  }

  async findOne(id: string): Promise<Artist> {
    const options: FindOptions = {
      where: { id },
      include: [
        {
          model: this.paintingModel,
          as: 'paintings'
        }
      ]
    }
    const artist = await this.artistModel.findOne(options)
    if (!artist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }
    return artist
  }

  async update(id: number, artist: UpdateArtistDto): Promise<Artist> {
    const existingArtist = await this.findOne(id.toString())
    if (!existingArtist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }
    // Проверяем, изменился ли URL картинки
    if (existingArtist.imgUrl !== artist.imgUrl) {
      // Удаляем старый файл, если URL изменился
      const prevImgUrl = existingArtist.imgUrl
      const fileName = getFileNameFromUrl(prevImgUrl)
      await this.storageService.deleteFile(fileName, 'artists')
    }

    const data = await this.artistModel.update(artist, {
      where: { id },
      returning: true
    })

    return data[1][0]
  }

  async delete(id: string): Promise<void> {
    const artist = await this.findOne(id)

    if (!artist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }

    const imgUrl = artist.imgUrl
    const fileName = getFileNameFromUrl(imgUrl)

    try {
      await this.storageService.deleteFile(fileName, 'artists')
      await artist.destroy()
    } catch (error) {
      throw new InternalServerErrorException(
        `Error deleting artist: ${error.message}`
      )
    }
  }

  async deleteMany(ids: string): Promise<{ deletedArtistCount: number }> {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    let deletedArtistCount = 0
    for (const id of idArray) {
      try {
        const artist = await this.findOne(id)

        const imgUrl = artist.dataValues.imgUrl
        const fileName = getFileNameFromUrl(imgUrl)

        await this.storageService.deleteFile(fileName, 'artists')
        await artist.destroy()
        deletedArtistCount++
      } catch (error) {
        throw new InternalServerErrorException(
          `Error deleting artists: ${error.message}`
        )
      }
    }
    return { deletedArtistCount }
  }
}
