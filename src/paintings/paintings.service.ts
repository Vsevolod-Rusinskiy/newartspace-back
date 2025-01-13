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
import { Attributes } from '../attributes/models/attributes.model'
import { parsePriceRange } from '../utils/parsePriceRange'
import { parseSizeList } from '../utils/parseSizeList'
import { Sequelize } from 'sequelize-typescript'
import { PaintingAttributes } from './models/painting-attributes.model'

@Injectable()
export class PaintingsService {
  private readonly logger = new Logger(PaintingsService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    @InjectModel(PaintingAttributes)
    private paintingAttributesModel: typeof PaintingAttributes,
    private readonly storageService: StorageService
  ) {}

  async create(createPaintingDto: CreatePaintingDto): Promise<Painting> {
    try {
      const painting = new Painting({
        ...createPaintingDto,
        artistId: createPaintingDto.artistId,
        priority: 0
      })
      await painting.save()

      // Сохраняем связи с материалами
      if (createPaintingDto.materials) {
        for (const materialId of createPaintingDto.materials) {
          await this.paintingAttributesModel.create({
            paintingId: painting.id,
            attributeId: materialId,
            type: 'materialsList'
          })
        }
      }

      // Сохраняем связи с техниками
      if (createPaintingDto.techniques) {
        for (const techniqueId of createPaintingDto.techniques) {
          await this.paintingAttributesModel.create({
            paintingId: painting.id,
            attributeId: techniqueId,
            type: 'techniquesList'
          })
        }
      }

      // Сохраняем связи с темами
      if (createPaintingDto.themes) {
        for (const themeId of createPaintingDto.themes) {
          await this.paintingAttributesModel.create({
            paintingId: painting.id,
            attributeId: themeId,
            type: 'themesList'
          })
        }
      }

      if (createPaintingDto.colors) {
        for (const colorId of createPaintingDto.colors) {
          await this.paintingAttributesModel.create({
            paintingId: painting.id,
            attributeId: colorId,
            type: 'colorsList'
          })
        }
      }

      // Получаем полные данные о картине с атрибутами
      const fullPainting = await this.paintingModel.findOne({
        where: { id: painting.id },
        include: [
          { model: Artist, attributes: ['artistName'] },
          { model: Attributes, through: { attributes: ['type'] } }
        ]
      })

      return fullPainting
    } catch (error) {
      this.logger.error(
        `Error creating painting: ${error.message}`,
        error.stack
      )
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
    filters?: string,
    artStyle?: string
  ): Promise<{ data: Painting[]; total: number }> {
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

    this.logger.debug(`sortField: ${sortField}, order: ${order}`)
    /* filters starts */
    const parsedFilters = filters ? JSON.parse(filters) : {}
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
    if (materialsList.length) whereConditions.material = materialsList
    if (techniquesList.length) whereConditions.technique = techniquesList
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

    if (artStyle) whereConditions.artStyle = artStyle

    // Логика для определения порядка сортировки для react-admin
    // Определяем порядок сортировки в зависимости от типа поля:
    // 1. Для имени автора используем COLLATE для регистронезависимой сортировки.
    // 2. Для числовых полей используем стандартную сортировку без COLLATE.
    // 3. Для остальных строковых полей применяем COLLATE для регистронезависимой сортировки.
    let orderBy
    if (sortField === 'artist.artistName') {
      orderBy = Sequelize.literal(`"artist"."artistName" COLLATE "POSIX"`)
    } else if (
      [
        'id',
        'priority',
        'price',
        'height',
        'width',
        'yearOfCreation',
        'createdAt',
        'updatedAt'
      ].includes(sortField)
    ) {
      orderBy = Sequelize.col(`Painting.${sortField}`)
    } else {
      orderBy = Sequelize.literal(`"Painting"."${sortField}" COLLATE "POSIX"`)
    }

    const options: FindOptions = {
      order: ['createdAt', 'price'].includes(sortField)
        ? [[orderBy, order]]
        : [
            [Sequelize.col('priority'), 'DESC'],
            [orderBy, order]
          ],
      limit: limit,
      offset: (page - 1) * limit,
      where: whereConditions,
      include: [
        { model: Artist, attributes: ['artistName'], required: true },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    }

    const total = await this.paintingModel.count({
      where: whereConditions,
      distinct: true
    })

    const data = await this.paintingModel.findAll(options)

    return { data, total }
  }

  async findOne(id: string): Promise<Painting> {
    const options: FindOptions = {
      where: { id },
      include: [
        { model: Artist, attributes: ['artistName'] },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
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

    // Обновляем связи с материалами
    if (painting.materials) {
      await PaintingAttributes.destroy({
        where: { paintingId: id, type: 'materialsList' }
      })
      for (const materialId of painting.materials) {
        await PaintingAttributes.create({
          paintingId: id,
          attributeId: materialId,
          type: 'materialsList'
        })
      }
    }

    // Обновляем связи с техниками
    if (painting.techniques) {
      await this.paintingAttributesModel.destroy({
        where: { paintingId: id, type: 'techniquesList' }
      })
      for (const techniqueId of painting.techniques) {
        await PaintingAttributes.create({
          paintingId: id,
          attributeId: techniqueId,
          type: 'techniquesList'
        })
      }
    }

    // Обновляем связи с темами
    if (painting.themes) {
      await PaintingAttributes.destroy({
        where: { paintingId: id, type: 'themesList' }
      })
      for (const themeId of painting.themes) {
        await this.paintingAttributesModel.create({
          paintingId: id,
          attributeId: themeId,
          type: 'themesList'
        })
      }
    }

    if (painting.colors) {
      await PaintingAttributes.destroy({
        where: { paintingId: id, type: 'colorsList' }
      })
      for (const colorId of painting.colors) {
        await PaintingAttributes.create({
          paintingId: id,
          attributeId: colorId,
          type: 'colorsList'
        })
      }
    }

    // Теперь делаем запрос для получения обновленных данных с автором
    const updatedPainting = await this.paintingModel.findOne({
      where: { id: id },
      include: [
        { model: Artist, attributes: ['artistName'] },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    })

    if (!updatedPainting) {
      throw new NotFoundException(`Updated painting with id ${id} not found`)
    }

    return updatedPainting
  }

  async delete(id: string): Promise<void> {
    const painting = await this.findOne(id)

    if (!painting) {
      this.logger.error(`Painting with id ${id} not found`)
      throw new NotFoundException(`Painting with id ${id} not found`)
    }

    const imgUrl = painting.imgUrl
    const fileName = getFileNameFromUrl(imgUrl)

    try {
      // Удаляем связанные записи из PaintingAttributes
      await PaintingAttributes.destroy({
        where: { paintingId: id }
      })

      await this.storageService.deleteFile(fileName, 'paintings')
      await painting.destroy()
    } catch (error) {
      this.logger.error(`Error deleting painting: ${error.message}`)
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

        if (!painting) {
          this.logger.error(`Painting with id ${id} not found`)
          continue // Пропускаем, если картина не найдена
        }

        const imgUrl = painting.dataValues.imgUrl
        const fileName = getFileNameFromUrl(imgUrl)

        // Удаляем связанные записи из PaintingAttributes
        await PaintingAttributes.destroy({
          where: { paintingId: id }
        })

        await this.storageService.deleteFile(fileName, 'paintings')
        await painting.destroy()
        deletedPaintingCount++
      } catch (error) {
        this.logger.error(
          `Error deleting painting with id ${id}: ${error.message}`
        )
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

  async findMany(ids: string) {
    this.logger.debug(`ids: ${ids}`, 1111111)
    if (!ids) {
      return []
    }

    const idArray = ids.split(',').map((id) => +id)

    if (!idArray.length) {
      return []
    }

    const paintings = await this.paintingModel.findAll({
      where: {
        id: {
          [Op.in]: idArray
        }
      },
      include: [
        { model: Artist, attributes: ['artistName'] },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    })

    return paintings
  }
}
