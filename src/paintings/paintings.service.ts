import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Op } from 'sequelize'
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
import { getFileNameFromUrl } from '../utils'
import { Artist } from '../artists/models/artist.model'
import { parsePriceRange } from '../utils/parsePriceRange'
import { parseSizeList } from '../utils/parseSizeList'
import { Sequelize } from 'sequelize-typescript'

@Injectable()
export class PaintingsService {
  private readonly logger = new Logger(PaintingsService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private readonly storageService: StorageService
  ) {}

  async create(createPaintingDto: CreatePaintingDto): Promise<Painting> {
    // todo
    this.logger.debug(createPaintingDto)
    try {
      const painting = new Painting({
        ...createPaintingDto,
        artistId: createPaintingDto.artistId
      })
      await painting.save()
      return painting
    } catch (error) {
      throw new InternalServerErrorException(
        `Error creating painting: ${error.message}`
      )
    }
  }

  async getAllSortedPaintings(
    sort?: string,
    order?: 'ASC' | 'DESC',
    page?: number,
    limit?: number,
    filters?: string
  ): Promise<{ data: Painting[]; total: number }> {
    order = order || 'ASC'
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

    /* filters starts */
    const parsedFilters = filters ? JSON.parse(filters) : {}
    // this.logger.debug(parsedFilters, 'parsedFilters')
    const {
      artTypesList = [],
      colorsList = [],
      formatsList = [],
      materialsList = [],
      techniquesList = [],
      stylesList = [],
      themesList = [],
      priceList = '',
      sizeList = []
    } = parsedFilters

    const { min, max } = parsePriceRange(priceList)
    const sizeConditions = parseSizeList(sizeList)

    const whereConditions: any = {}

    if (artTypesList.length) whereConditions.artType = artTypesList
    if (colorsList.length) whereConditions.color = colorsList
    if (formatsList.length) whereConditions.format = formatsList
    if (materialsList.length) whereConditions.materials = materialsList
    if (techniquesList.length) whereConditions.techniques = techniquesList
    if (stylesList.length) whereConditions.style = stylesList
    if (themesList.length) whereConditions.theme = themesList
    if (priceList) {
      whereConditions.price = {
        [Op.gte]: min,
        [Op.lte]: max
      }
    }
    if (sizeList.length) {
      whereConditions[Op.or] = sizeConditions.map(
        ({ heightMin, heightMax, widthMin, widthMax }) => ({
          height: { [Op.gte]: heightMin, [Op.lte]: heightMax },
          width: { [Op.gte]: widthMin, [Op.lte]: widthMax }
        })
      )
    }
    /* filters ends */

    const options: FindOptions = {
      order: [
        [
          sortField === 'artist.artistName' // Проверяем, если сортировка по имени автора
            ? Sequelize.literal(`"artist"."artistName" COLLATE "POSIX"`) // Используем COLLATE для имени автора
            : Sequelize.literal(`"Painting"."${sortField}" COLLATE "POSIX"`), // Используем COLLATE для других полей
          order
        ]
      ],
      limit: limit,
      offset: (page - 1) * limit,
      where: whereConditions,
      include: [{ model: Artist, attributes: ['artistName'] }] // Убедитесь, что Artist включен
    }

    const { rows: data, count: total } =
      await this.paintingModel.findAndCountAll(options)
    return { data, total }
  }

  async findOne(id: string): Promise<Painting> {
    const options: FindOptions = {
      where: { id },
      include: [{ model: Artist, attributes: ['artistName'] }]
    }
    const painting = await this.paintingModel.findOne(options)
    if (!painting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }
    return painting
  }

  async update(id: number, painting: UpdatePaintingDto): Promise<Painting> {
    const existingPainting = await this.findOne(id.toString())
    if (!existingPainting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }

    // Проверяем, изменился ли URL картинки
    if (existingPainting.imgUrl !== painting.imgUrl) {
      // Удаляем старый файл, ели URL изменился
      const prevImgUrl = existingPainting.imgUrl
      const fileName = getFileNameFromUrl(prevImgUrl)
      await this.storageService.deleteFile(fileName, 'paintings')
    }

    // Обновляем картину без include
    await this.paintingModel.update(
      {
        ...painting,
        artistId: painting.artistId
      },
      {
        where: { id: id }
      }
    )

    // Теперь делаем запрос для получения обновленных данных с автором
    const updatedPainting = await this.paintingModel.findOne({
      where: { id: id },
      include: [{ model: Artist, attributes: ['artistName'] }]
    })

    if (!updatedPainting) {
      throw new NotFoundException(`Updated painting with id ${id} not found`)
    }

    return updatedPainting
  }

  async delete(id: string): Promise<void> {
    const painting = await this.findOne(id)

    if (!painting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }

    const imgUrl = painting.imgUrl
    const fileName = getFileNameFromUrl(imgUrl)

    try {
      await this.storageService.deleteFile(fileName, 'paintings')
      await painting.destroy()
    } catch (error) {
      throw new InternalServerErrorException(
        `Error deleting painting: ${error.message}`
      )
    }
  }

  async deleteMany(ids: string): Promise<{ deletedPaintingCount: number }> {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    let deletedPaintingCount = 0
    for (const id of idArray) {
      try {
        const painting = await this.findOne(id)

        const imgUrl = painting.dataValues.imgUrl
        const fileName = getFileNameFromUrl(imgUrl)

        await this.storageService.deleteFile(fileName, 'paintings')
        await painting.destroy()
        deletedPaintingCount++
      } catch (error) {
        throw new InternalServerErrorException(
          `Error deleting paintings: ${error.message}`
        )
      }
    }
    return { deletedPaintingCount }
  }

  async getFilteredPaintings(
    artTypesList: number[],
    stylesList: number[]
  ): Promise<Painting[]> {
    const options: FindOptions = {
      where: {
        artTypeId: artTypesList.length ? artTypesList : undefined,
        styleId: stylesList.length ? stylesList : undefined
      },
      include: [{ model: Artist, attributes: ['artistName'] }]
    }

    try {
      const paintings = await this.paintingModel.findAll(options)
      return paintings
    } catch (error) {
      this.logger.error('Error fetching filtered paintings:', error)
      throw new InternalServerErrorException(
        `Error fetching filtered paintings: ${error.message}`
      )
    }
  }
}
