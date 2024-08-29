import { InjectModel } from '@nestjs/sequelize'
import { FindOptions } from 'sequelize'
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

@Injectable()
export class ArtistsService {
  private readonly logger = new Logger(ArtistsService.name)

  constructor(
    @InjectModel(Artist)
    private artistModel: typeof Artist,
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
    limit?: number
  ): Promise<{ data: Artist[]; total: number }> {
    order = 'ASC'
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

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

    const options: FindOptions = {
      order: [[sortField, order]],
      limit: limit,
      offset: (page - 1) * limit
    }

    const { rows: data, count: total } =
      await this.artistModel.findAndCountAll(options)
    return { data, total }
  }

  async findOne(id: string): Promise<Artist> {
    const options: FindOptions = {
      where: { id }
    }
    const artist = await this.artistModel.findOne(options)
    if (!artist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }
    return artist
  }

  async update(
    id: number,
    artist: UpdateArtistDto
  ): Promise<[number, Artist[]]> {
    const existingArtist = await this.findOne(id.toString())

    if (!existingArtist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }

    // Проверяем, изменился ли URL картинки
    if (existingArtist.artistUrl !== artist.artistUrl) {
      // Удаляем старый файл, если URL изменился
      const prevArtistUrl = existingArtist.artistUrl
      const fileName = getFileNameFromUrl(prevArtistUrl)
      await this.storageService.deleteFile(fileName, 'artists')
    }

    return this.artistModel.update(artist, {
      where: { id },
      returning: true
    })
  }

  async delete(id: string): Promise<void> {
    const artist = await this.findOne(id)

    if (!artist) {
      throw new NotFoundException(`Artist with id ${id} not found`)
    }

    const artistUrl = artist.artistUrl
    const fileName = getFileNameFromUrl(artistUrl)

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

        const artistUrl = artist.dataValues.artistUrl
        const fileName = getFileNameFromUrl(artistUrl)

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