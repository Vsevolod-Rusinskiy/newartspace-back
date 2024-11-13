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
      // Логируем данные, полученные с фронта
      this.logger.debug(
        'Received data from frontend:',
        JSON.stringify(createPaintingDto, null, 2)
      )

      const painting = new Painting({
        ...createPaintingDto,
        artistId: createPaintingDto.artistId
      })
      this.logger.debug(
        'Painting data before save:',
        JSON.stringify(painting, null, 2)
      )
      await painting.save()

      // // Сохраняем связи с материалами
      // if (createPaintingDto.materials) {
      //   const materials = createPaintingDto.materials.map((materialId) => ({
      //     attributeId: materialId || null,
      //     type: 'materialsList'
      //   }))
      //   await painting.$set('attributes', materials)
      // }

      // // Сохраняем связи с техниками
      // if (createPaintingDto.techniques) {
      //   const techniques = createPaintingDto.techniques.map((techniqueId) => ({
      //     attributeId: techniqueId || null,
      //     type: 'techniquesList'
      //   }))
      //   await painting.$set('attributes', techniques)
      // }

      // // Сохраняем связи с темами
      // if (createPaintingDto.themes) {
      //   const themes = createPaintingDto.themes.map((themeId) => ({
      //     attributeId: themeId || null,
      //     type: 'themesList'
      //   }))
      //   await painting.$set('attributes', themes)
      // }
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

      return painting
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
      ['id', 'priority', 'price', 'height', 'width', 'yearOfCreation'].includes(
        sortField
      )
    ) {
      orderBy = Sequelize.col(`Painting.${sortField}`)
    } else {
      orderBy = Sequelize.literal(`"Painting"."${sortField}" COLLATE "POSIX"`)
    }

    const options: FindOptions = {
      order: [
        [Sequelize.col('priority'), 'DESC'],
        [orderBy, order]
      ],
      limit: limit,
      offset: (page - 1) * limit,
      where: whereConditions,
      include: [{ model: Artist, attributes: ['artistName'] }]
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

    // // Обновляем связи с материалами
    // if (painting.materials) {
    //   const materials = painting.materials.map((materialId) => ({
    //     attributeId: materialId || null,
    //     type: 'materialsList'
    //   }))
    //   await existingPainting.$set('attributes', materials)
    // }

    // // Обновляем связи с техниками
    // if (painting.techniques) {
    //   const techniques = painting.techniques.map((techniqueId) => ({
    //     attributeId: techniqueId || null,
    //     type: 'techniquesList'
    //   }))
    //   await existingPainting.$set('attributes', techniques)
    // }

    // // Обновляем связи с темами
    // if (painting.themes) {
    //   const themes = painting.themes.map((themeId) => ({
    //     attributeId: themeId || null,
    //     type: 'themesList'
    //   }))
    //   await existingPainting.$set('attributes', themes)
    // }
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
