import { BadRequestException } from '@nestjs/common'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { PaintingsService } from './paintings.service'

describe('PaintingsService image reference coordination', () => {
  const imgUrl =
    'https://storage.yandexcloud.net/newartspace-images-dev/paintings/new-file.jpg'

  const createHarness = (fileExists: boolean) => {
    const transaction = {}
    const painting = { id: 501, save: jest.fn().mockResolvedValue(undefined) }
    const paintingModel = {
      build: jest.fn(() => painting),
      findOne: jest.fn().mockResolvedValue(painting)
    }
    const paintingAttributesModel = {
      create: jest.fn(),
      destroy: jest.fn()
    }
    const storageService = {
      fileExists: jest.fn().mockResolvedValue(fileExists),
      deleteFile: jest.fn()
    }
    const sequelize = {
      transaction: jest.fn(async (callback) => callback(transaction)),
      query: jest.fn().mockResolvedValue(undefined)
    }
    const service = new (PaintingsService as any)(
      paintingModel as unknown as typeof Painting,
      paintingAttributesModel as unknown as typeof PaintingAttributes,
      storageService,
      sequelize
    ) as PaintingsService

    return {
      painting,
      paintingModel,
      storageService,
      sequelize,
      transaction,
      service
    }
  }

  it('locks and validates a managed image before creating its database reference', async () => {
    const {
      painting,
      paintingModel,
      storageService,
      sequelize,
      transaction,
      service
    } = createHarness(true)

    await expect(
      service.create({ imgUrl, title: 'Новая картина', artistId: 32 })
    ).resolves.toBe(painting)

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({ replacements: { imgUrl }, transaction })
    )
    expect(storageService.fileExists).toHaveBeenCalledWith(
      'new-file.jpg',
      'paintings'
    )
    expect(paintingModel.build).toHaveBeenCalled()
    expect(painting.save).toHaveBeenCalledWith({ transaction })
  })

  it('does not create a database reference after concurrent image cleanup', async () => {
    const { paintingModel, service } = createHarness(false)

    await expect(
      service.create({ imgUrl, title: 'Устаревшая ссылка', artistId: 32 })
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(paintingModel.build).not.toHaveBeenCalled()
  })
})
