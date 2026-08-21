import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Op, Transaction } from 'sequelize'
import {
  BadRequestException,
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
import {
  ManagedPaintingImageReference,
  isSafeManagedPaintingImageFileName,
  resolveManagedPaintingImageFileName,
  resolveManagedPaintingImageUrl
} from './painting-image-reference'

export interface PaintingWithAuthor extends Painting {
  author: string | null
}

export interface PaintingDeletionResult {
  deletedPaintingIds: number[]
  deletedPaintingCount: number
  skippedSharedImageCount: number
  storageCleanupErrorCount: number
}

const MAX_BULK_PAINTING_DELETE_IDS = 100

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
    if (createPaintingDto.imgUrl === '') {
      throw new BadRequestException('Painting image URL cannot be empty')
    }
    try {
      return await this.sequelize.transaction(async (transaction) => {
        let imageReference: ManagedPaintingImageReference | undefined
        if (createPaintingDto.imgUrl) {
          imageReference = await this.assertImageReferenceAvailable(
            createPaintingDto.imgUrl,
            transaction
          )
        }
        const painting = this.paintingModel.build({
          ...createPaintingDto,
          ...(imageReference ? { imgUrl: imageReference.canonicalUrl } : {}),
          artistId: createPaintingDto.artistId,
          priority: 0
        })
        await painting.save({ transaction })

        const attributeGroups = [
          ['materialsList', createPaintingDto.materials],
          ['techniquesList', createPaintingDto.techniques],
          ['themesList', createPaintingDto.themes],
          ['colorsList', createPaintingDto.colors]
        ] as const
        for (const [type, attributeIds] of attributeGroups) {
          for (const attributeId of attributeIds || []) {
            await this.paintingAttributesModel.create(
              { paintingId: painting.id, attributeId, type },
              { transaction }
            )
          }
        }

        return this.paintingModel.findOne({
          where: { id: painting.id },
          include: [
            { model: Artist, attributes: ['artistName'] },
            { model: Attributes, through: { attributes: ['type'] } }
          ],
          transaction
        })
      })
    } catch (error) {
      if (error instanceof BadRequestException) throw error
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
    if (painting.imgUrl === '') {
      throw new BadRequestException('Painting image URL cannot be empty')
    }
    let previousImgUrl: string | null = null
    let replacesImage = false
    const updatedPainting = await this.sequelize.transaction(
      async (transaction) => {
        await this.setTransactionTimeouts(transaction)
        const existingPainting = await this.paintingModel.findOne({
          where: { id },
          transaction,
          lock: transaction.LOCK.UPDATE
        })
        if (!existingPainting) {
          throw new NotFoundException(`Painting with id ${id} not found`)
        }

        let updateData: UpdatePaintingDto = painting
        if (
          painting.imgUrl !== undefined &&
          painting.imgUrl !== null &&
          existingPainting.imgUrl !== painting.imgUrl
        ) {
          const imageReference = await this.assertImageReferenceAvailable(
            painting.imgUrl,
            transaction
          )
          previousImgUrl = existingPainting.imgUrl
          replacesImage = true
          updateData = { ...painting, imgUrl: imageReference.canonicalUrl }
        }
        await this.paintingModel.update(
          { ...updateData, artistId: updateData.artistId },
          { where: { id }, transaction }
        )

        const attributeGroups = [
          ['materialsList', painting.materials],
          ['techniquesList', painting.techniques],
          ['themesList', painting.themes],
          ['colorsList', painting.colors]
        ] as const
        for (const [type, attributeIds] of attributeGroups) {
          if (!attributeIds) continue
          await this.paintingAttributesModel.destroy({
            where: { paintingId: id, type },
            transaction
          })
          for (const attributeId of attributeIds) {
            await this.paintingAttributesModel.create(
              { paintingId: id, attributeId, type },
              { transaction }
            )
          }
        }

        return this.paintingModel.findOne({
          where: { id },
          include: [
            { model: Artist, attributes: ['artistName'] },
            { model: Attributes, through: { attributes: ['type'] } }
          ],
          transaction
        })
      }
    )

    if (!updatedPainting) {
      throw new NotFoundException(`Updated painting with id ${id} not found`)
    }

    if (replacesImage && previousImgUrl) {
      await this.cleanupDeletedPaintingImages([{ id, imgUrl: previousImgUrl }])
    }

    return updatedPainting
  }

  async delete(id: string): Promise<PaintingDeletionResult> {
    const paintingId = this.parsePaintingId(id)
    return this.deletePaintingsByIds([paintingId])
  }

  private parsePaintingId(id: unknown): number {
    const paintingId =
      typeof id === 'number'
        ? id
        : typeof id === 'string' && /^[1-9]\d*$/.test(id)
          ? Number(id)
          : Number.NaN
    if (!Number.isSafeInteger(paintingId) || paintingId <= 0) {
      throw new BadRequestException('Painting ids must be positive integers')
    }
    return paintingId
  }

  private parsePaintingIds(ids: string): number[] {
    let parsedIds: unknown
    try {
      parsedIds = JSON.parse(ids)
    } catch {
      throw new BadRequestException('Painting ids must be a JSON array')
    }
    if (!Array.isArray(parsedIds) || parsedIds.length === 0) {
      throw new BadRequestException('Painting ids must be a non-empty array')
    }
    const paintingIds = [
      ...new Set(parsedIds.map((id) => this.parsePaintingId(id)))
    ]
    if (paintingIds.length > MAX_BULK_PAINTING_DELETE_IDS) {
      throw new BadRequestException(
        `At most ${MAX_BULK_PAINTING_DELETE_IDS} paintings can be deleted at once`
      )
    }
    return paintingIds
  }

  private async deletePaintingsByIds(
    paintingIds: number[]
  ): Promise<PaintingDeletionResult> {
    const transaction = await this.sequelize.transaction()
    let paintings: Painting[]
    try {
      await this.setTransactionTimeouts(transaction)
      const foundPaintings = await this.paintingModel.findAll({
        where: { id: { [Op.in]: paintingIds } },
        transaction,
        lock: transaction.LOCK.UPDATE
      })
      const paintingsById = new Map(
        foundPaintings.map((painting) => [Number(painting.id), painting])
      )
      const missingIds = paintingIds.filter((id) => !paintingsById.has(id))
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Paintings with ids ${missingIds.join(',')} not found`
        )
      }
      paintings = paintingIds.map((id) => paintingsById.get(id))

      await this.paintingAttributesModel.destroy({
        where: { paintingId: { [Op.in]: paintingIds } },
        transaction
      })
      for (const painting of paintings) {
        await painting.destroy({ transaction })
      }
      await transaction.commit()
    } catch (error) {
      const transactionFinished = (
        transaction as unknown as { finished?: string }
      ).finished
      if (!transactionFinished) {
        try {
          await transaction.rollback()
        } catch (rollbackError) {
          this.logger.error(
            JSON.stringify({
              event: 'painting_delete_rollback_failed',
              paintingIds,
              errorName: rollbackError?.name || 'UnknownError'
            })
          )
        }
      }
      if (error?.name === 'SequelizeForeignKeyConstraintError') {
        throw new ConflictException(
          `At least one painting is referenced by another record`
        )
      }
      throw error
    }

    const cleanup = await this.cleanupDeletedPaintingImages(
      paintings.map(({ id, imgUrl }) => ({ id: Number(id), imgUrl }))
    )
    return {
      deletedPaintingIds: paintingIds,
      deletedPaintingCount: paintingIds.length,
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
      const deletedPaintingIds = deletedPaintings.map(({ id }) => id)
      let imageReference: ManagedPaintingImageReference | null = null
      try {
        imageReference = resolveManagedPaintingImageUrl(
          imgUrl,
          process.env.BUCKET_NAME || ''
        )
      } catch {
        imageReference = null
      }
      const objectKey = imageReference?.objectKey || null
      let phase: 'reference_check' | 'storage_delete' = 'reference_check'
      try {
        if (!imageReference) {
          throw new Error('Painting image URL is not a managed canonical URL')
        }
        const cleanupResult = await this.withImageReferenceLock(
          imageReference.objectKey,
          async (transaction) => {
            const remainingReferences = await this.paintingModel.count({
              where: { imgUrl: imageReference.canonicalUrl },
              transaction
            })
            if (remainingReferences > 0) return 'skipped' as const
            if (
              await this.hasPotentialImageReference(
                imageReference.fileName,
                imageReference.canonicalUrl,
                transaction
              )
            ) {
              return 'skipped' as const
            }

            phase = 'storage_delete'
            await this.storageService.deleteFile(
              imageReference.fileName,
              'paintings'
            )
            return 'deleted' as const
          }
        )
        if (cleanupResult === 'skipped') {
          skippedSharedImageCount++
          this.logger.log(
            `Skipping shared painting image cleanup for deleted ids ${deletedPaintings.map(({ id }) => id).join(',')}`
          )
        }
      } catch (error) {
        storageCleanupErrorCount++
        const errorName = error?.name || 'UnknownError'
        const errorMessage = this.sanitizeCleanupErrorMessage(error?.message)
        this.logger.error(
          JSON.stringify({
            event: 'painting_image_cleanup_failed',
            deletedPaintingIds,
            phase,
            objectKey,
            category: 'paintings',
            errorName,
            errorMessage
          })
        )
      }
    }

    return { skippedSharedImageCount, storageCleanupErrorCount }
  }

  private async withImageReferenceLock<T>(
    objectKey: string,
    operation: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    return this.sequelize.transaction(async (transaction) => {
      await this.setTransactionTimeouts(transaction)
      await this.lockImageReference(objectKey, transaction)
      return operation(transaction)
    })
  }

  private async assertImageReferenceAvailable(
    imgUrl: string,
    transaction: Transaction
  ): Promise<ManagedPaintingImageReference> {
    const imageReference = resolveManagedPaintingImageUrl(
      imgUrl,
      process.env.BUCKET_NAME || ''
    )
    await this.setTransactionTimeouts(transaction)
    await this.lockImageReference(imageReference.objectKey, transaction)
    if (
      !(await this.storageService.fileExists(
        imageReference.fileName,
        'paintings'
      ))
    ) {
      throw new BadRequestException('Painting image does not exist')
    }
    return imageReference
  }

  private async lockImageReference(
    objectKey: string,
    transaction: Transaction
  ): Promise<void> {
    await this.sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtextextended(:objectKey, 0))',
      { replacements: { objectKey }, transaction }
    )
  }

  async deleteUnusedImage(fileName: string): Promise<{ message: string }> {
    const imageReference = resolveManagedPaintingImageFileName(
      fileName,
      process.env.BUCKET_NAME || ''
    )
    await this.withImageReferenceLock(
      imageReference.objectKey,
      async (transaction) => {
        const remainingReferences = await this.paintingModel.count({
          where: { imgUrl: imageReference.canonicalUrl },
          transaction
        })
        if (remainingReferences > 0) {
          throw new ConflictException(
            'Painting image is still referenced by a painting'
          )
        }
        if (
          await this.hasPotentialImageReference(
            imageReference.fileName,
            imageReference.canonicalUrl,
            transaction
          )
        ) {
          throw new ConflictException(
            'Painting image is still referenced by a painting'
          )
        }
        await this.storageService.deleteFile(
          imageReference.fileName,
          'paintings'
        )
      }
    )
    return { message: 'File deleted successfully' }
  }

  private async setTransactionTimeouts(
    transaction: Transaction
  ): Promise<void> {
    await this.sequelize.query(
      `SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '7s'`,
      { transaction }
    )
  }

  private async hasPotentialImageReference(
    fileName: string,
    canonicalUrl: string,
    transaction: Transaction
  ): Promise<boolean> {
    const paintings = await this.paintingModel.findAll({
      attributes: ['imgUrl'],
      transaction
    })
    return paintings.some((painting) => {
      const imgUrl = painting?.imgUrl
      if (typeof imgUrl !== 'string' || imgUrl.length === 0) return false
      if (imgUrl === canonicalUrl) return false
      return this.getImageBasename(imgUrl) === fileName
    })
  }

  private getImageBasename(imgUrl: string): string | null {
    const withoutQueryOrHash = imgUrl.split(/[?#]/, 1)[0]
    const rawBasename = withoutQueryOrHash.split('/').pop() || ''
    let basename = rawBasename
    try {
      basename = decodeURIComponent(rawBasename)
    } catch {
      return null
    }
    return isSafeManagedPaintingImageFileName(basename) ? basename : null
  }

  private sanitizeCleanupErrorMessage(message: unknown): string {
    const normalized =
      typeof message === 'string' ? message : 'Unknown cleanup error'
    return normalized
      .replace(
        /(access[_-]?key|secret[_-]?access[_-]?key|authorization|token|password)(\s*[:=]\s*)[^\s,;]+/gi,
        '$1$2[redacted]'
      )
      .slice(0, 500)
  }

  async deleteMany(ids: string): Promise<PaintingDeletionResult> {
    return this.deletePaintingsByIds(this.parsePaintingIds(ids))
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
