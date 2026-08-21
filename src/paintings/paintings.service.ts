import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Op } from 'sequelize'
import {
  ConflictException,
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
import {
  rankSimilarPaintings,
  SimilarPaintingCandidate
} from './similar-paintings'

export interface PaintingWithAuthor extends Painting {
  author: string | null
}

export interface PaintingDeletionResult {
  deletedPaintingIds: number[]
  deletedPaintingCount: number
  skippedSharedImageCount: number
  storageCleanupErrorCount: number
}

@Injectable()
export class PaintingsService {
  private readonly logger = new Logger(PaintingsService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    @InjectModel(PaintingAttributes)
    private paintingAttributesModel: typeof PaintingAttributes,
    private readonly storageService: StorageService,
    private readonly sequelize: Sequelize
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
    artStyle?: string,
    filter?: string,
    includeHidden = false
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
      formatsList = [],
      colorsList = [],
      materialsList = [],
      techniquesList = [],
      themesList = [],
      stylesList = [],
      priceList = '',
      sizeList = []
    } = parsedFilters

    const { min, max } = parsePriceRange(priceList)
    const sizeConditions = parseSizeList(sizeList)

    // Извлекаем строки значений из новых структур
    const colorValuesList = colorsList.map((item) => Object.values(item)[0])
    const materialValuesList = materialsList.map(
      (item) => Object.values(item)[0]
    )
    const techniqueValuesList = techniquesList.map(
      (item) => Object.values(item)[0]
    )
    const themeValuesList = themesList.map((item) => Object.values(item)[0])

    const whereConditions: any = includeHidden ? {} : { isHidden: false }
    const orConditions = []

    // Добавляем условия поиска по названию и автору
    if (filter) {
      try {
        const searchFilter = JSON.parse(filter)
        if (searchFilter.title) {
          whereConditions.title = {
            [Op.iLike]: `%${searchFilter.title}%`
          }
        }
        if (searchFilter.id) {
          const paintingId = Number(searchFilter.id)
          if (!Number.isNaN(paintingId)) {
            whereConditions.id = paintingId
          }
        }
      } catch (error) {
        this.logger.error('Failed to parse search filter:', error)
      }
    }

    if (artTypesList.length) whereConditions.artType = artTypesList
    if (formatsList.length) whereConditions.format = formatsList
    if (stylesList.length) whereConditions.style = stylesList
    if (materialValuesList.length) {
      orConditions.push(
        { material: materialValuesList },
        {
          id: {
            [Op.in]: Sequelize.literal(`(
              SELECT DISTINCT "paintingId"
              FROM "PaintingAttributes" pa
              JOIN "Attributes" a ON a.id = pa."attributeId"
              WHERE pa.type = 'materialsList'
              AND a.value IN ('${materialValuesList.join("','")}')
            )`)
          }
        }
      )
    }
    if (techniqueValuesList.length) {
      orConditions.push(
        { technique: techniqueValuesList },
        {
          id: {
            [Op.in]: Sequelize.literal(`(
              SELECT DISTINCT "paintingId"
              FROM "PaintingAttributes" pa
              JOIN "Attributes" a ON a.id = pa."attributeId"
              WHERE pa.type = 'techniquesList'
              AND a.value IN ('${techniqueValuesList.join("','")}')
            )`)
          }
        }
      )
    }
    if (themeValuesList.length) {
      orConditions.push(
        { theme: themeValuesList },
        {
          id: {
            [Op.in]: Sequelize.literal(`(
              SELECT DISTINCT "paintingId"
              FROM "PaintingAttributes" pa
              JOIN "Attributes" a ON a.id = pa."attributeId"
              WHERE pa.type = 'themesList'
              AND a.value IN ('${themeValuesList.join("','")}')
            )`)
          }
        }
      )
    }
    if (colorValuesList.length) {
      orConditions.push(
        { color: colorValuesList },
        {
          id: {
            [Op.in]: Sequelize.literal(`(
              SELECT DISTINCT "paintingId"
              FROM "PaintingAttributes" pa
              JOIN "Attributes" a ON a.id = pa."attributeId"
              WHERE pa.type = 'colorsList'
              AND a.value IN ('${colorValuesList.join("','")}')
            )`)
          }
        }
      )
    }
    if (priceList) {
      whereConditions.price = {
        [Op.gte]: min,
        [Op.lte]: max
      }
    }
    if (sizeList.length) {
      orConditions.push(
        ...sizeConditions.map(
          ({ heightMin, heightMax, widthMin, widthMax }) => ({
            height: { [Op.gte]: heightMin, [Op.lte]: heightMax },
            width: { [Op.gte]: widthMin, [Op.lte]: widthMax }
          })
        )
      )
    }

    if (orConditions.length) {
      whereConditions[Op.or] = orConditions
    }

    this.logger.debug(`Where conditions: ${JSON.stringify(whereConditions)}`)
    this.logger.debug(`OR conditions: ${JSON.stringify(orConditions)}`)
    /* filters ends */

    if (artStyle) whereConditions.artStyle = artStyle

    // Настройка условий для поиска по автору
    const includeArtist = {
      model: Artist,
      attributes: ['artistName'],
      required: true
    }

    if (filter) {
      try {
        const searchFilter = JSON.parse(filter)
        if (searchFilter.artist?.artistName) {
          includeArtist['where'] = {
            artistName: {
              [Op.iLike]: `%${searchFilter.artist.artistName}%`
            }
          }
        }
      } catch (error) {
        this.logger.error('Failed to parse artist search filter:', error)
      }
    }

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
        ? [
            [orderBy, order],
            [Sequelize.col('Painting.id'), 'ASC']
          ]
        : [
            [Sequelize.col('priority'), 'DESC'],
            [orderBy, order],
            [Sequelize.col('Painting.id'), 'ASC']
          ],
      limit: limit,
      offset: (page - 1) * limit,
      where: whereConditions,
      include: [
        includeArtist,
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    }

    const total = await this.paintingModel.count({
      where: whereConditions,
      distinct: true,
      include: [
        includeArtist,
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    })

    const data = await this.paintingModel.findAll(options)

    return { data, total }
  }

  async findOne(id: string): Promise<PaintingWithAuthor> {
    return this.findOneById(id)
  }

  async findPublicOne(id: string): Promise<PaintingWithAuthor> {
    return this.findOneById(id, false)
  }

  async findSimilar(id: string, limit = 20): Promise<PaintingWithAuthor[]> {
    const source = await this.findPublicOne(id)
    const candidates = await this.paintingModel.findAll({
      where: {
        id: { [Op.ne]: Number(id) },
        isHidden: false
      },
      include: [
        { model: Artist, attributes: ['artistName'] },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    })
    const ranked = rankSimilarPaintings(
      source as unknown as SimilarPaintingCandidate,
      candidates as unknown as SimilarPaintingCandidate[],
      limit
    )

    return ranked.map((painting) => {
      const paintingJson =
        typeof painting.toJSON === 'function'
          ? painting.toJSON()
          : (painting as unknown as Record<string, unknown>)
      const artist = paintingJson.artist as { artistName?: string } | undefined
      return {
        ...paintingJson,
        author: artist?.artistName || null
      } as PaintingWithAuthor
    })
  }

  private async findOneById(
    id: string,
    includeHidden = true
  ): Promise<PaintingWithAuthor> {
    const options: FindOptions = {
      where: includeHidden ? { id } : { id, isHidden: false },
      include: [
        { model: Artist, attributes: ['artistName'] },
        { model: Attributes, through: { attributes: ['type'] } }
      ]
    }
    const painting = await this.paintingModel.findOne(options)
    if (!painting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }
    const paintingJson = painting.toJSON()
    return {
      ...paintingJson,
      author: paintingJson.artist?.artistName || null
    } as PaintingWithAuthor
  }

  async update(id: number, painting: UpdatePaintingDto): Promise<Painting> {
    const existingPainting = await this.findOne(id.toString())
    if (!existingPainting) {
      throw new NotFoundException(`Painting with id ${id} not found`)
    }

    // Удаляем старый файл только если явно передан новый imgUrl и он другой.
    // Иначе PATCH без картинки (например, только title) сравнивает URL с undefined
    // и стирает файл в Object Storage.
    if (
      painting.imgUrl !== undefined &&
      painting.imgUrl !== null &&
      existingPainting.imgUrl !== painting.imgUrl
    ) {
      const prevImgUrl = existingPainting.imgUrl
      if (prevImgUrl) {
        const fileName = getFileNameFromUrl(prevImgUrl)
        await this.storageService.deleteFile(fileName, 'paintings')
      }
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

  async delete(id: string): Promise<PaintingDeletionResult> {
    const paintingId = Number(id)
    const transaction = await this.sequelize.transaction()
    let painting: Painting
    try {
      painting = await this.paintingModel.findOne({
        where: { id: paintingId },
        transaction,
        lock: transaction.LOCK.UPDATE
      })
      if (!painting) {
        throw new NotFoundException(`Painting with id ${id} not found`)
      }

      await this.paintingAttributesModel.destroy({
        where: { paintingId: { [Op.in]: [paintingId] } },
        transaction
      })
      await painting.destroy({ transaction })
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      if (error?.name === 'SequelizeForeignKeyConstraintError') {
        throw new ConflictException(
          `Painting with id ${id} is referenced by another record`
        )
      }
      throw error
    }

    const cleanup = await this.cleanupDeletedPaintingImages([
      { id: painting.id, imgUrl: painting.imgUrl }
    ])
    return {
      deletedPaintingIds: [paintingId],
      deletedPaintingCount: 1,
      ...cleanup
    }
  }

  private async cleanupDeletedPaintingImages(
    paintings: Array<{ id: number; imgUrl: string }>
  ): Promise<
    Pick<
      PaintingDeletionResult,
      'skippedSharedImageCount' | 'storageCleanupErrorCount'
    >
  > {
    const paintingsByImage = new Map<
      string,
      Array<{ id: number; imgUrl: string }>
    >()
    for (const painting of paintings) {
      const group = paintingsByImage.get(painting.imgUrl) || []
      group.push(painting)
      paintingsByImage.set(painting.imgUrl, group)
    }

    let skippedSharedImageCount = 0
    let storageCleanupErrorCount = 0
    for (const [imgUrl, deletedPaintings] of paintingsByImage) {
      try {
        const remainingReferences = await this.paintingModel.count({
          where: { imgUrl }
        })
        if (remainingReferences > 0) {
          skippedSharedImageCount++
          this.logger.log(
            `Skipping shared painting image cleanup for deleted ids ${deletedPaintings.map(({ id }) => id).join(',')}`
          )
          continue
        }

        const fileName = getFileNameFromUrl(imgUrl)
        if (!fileName) {
          throw new Error('Painting image URL does not contain a file name')
        }
        await this.storageService.deleteFile(fileName, 'paintings')
      } catch (error) {
        storageCleanupErrorCount++
        this.logger.error(
          `Post-commit painting image cleanup failed for deleted ids ${deletedPaintings.map(({ id }) => id).join(',')}: ${error.message}`
        )
      }
    }

    return { skippedSharedImageCount, storageCleanupErrorCount }
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
        isHidden: false,
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
        isHidden: false,
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
