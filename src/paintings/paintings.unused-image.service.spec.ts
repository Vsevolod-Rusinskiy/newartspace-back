import { ConflictException, Logger } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'

describe('PaintingsService.deleteUnusedImage', () => {
  const bucketName = 'newartspace-images-dev'
  const fileName = 'unused.jpg'

  const createHarness = (count = 0) => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } }
    const paintingModel = {
      count: jest.fn().mockResolvedValue(count),
      findAll: jest.fn().mockResolvedValue([])
    }
    const storageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined)
    }
    const sequelize = {
      transaction: jest.fn(async (callback) => callback(transaction)),
      query: jest.fn().mockResolvedValue(undefined)
    }
    const service = new (PaintingsService as any)(
      paintingModel as unknown as typeof Painting,
      {} as typeof PaintingAttributes,
      storageService,
      sequelize
    ) as PaintingsService
    return { paintingModel, storageService, sequelize, transaction, service }
  }

  beforeEach(() => {
    process.env.BUCKET_NAME = bucketName
  })

  it('rejects deleting an object still referenced by a painting', async () => {
    const { service, storageService } = createHarness(1)

    await expect(service.deleteUnusedImage(fileName)).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })

  it.each([
    'https://storage.yandexcloud.net/newartspace-images-dev/paintings/unused.jpg?token=secret',
    'https://newartspace-images-dev.storage.yandexcloud.net/paintings/unused.jpg'
  ])(
    'blocks deletion when a legacy alias references the same filename',
    async (aliasUrl) => {
      const { service, storageService, paintingModel } = createHarness()
      paintingModel.findAll.mockResolvedValue([{ imgUrl: aliasUrl }])

      await expect(service.deleteUnusedImage(fileName)).rejects.toBeInstanceOf(
        ConflictException
      )
      expect(storageService.deleteFile).not.toHaveBeenCalled()
    }
  )

  it('does not block an unrelated filename', async () => {
    const { service, storageService, paintingModel } = createHarness()
    paintingModel.findAll.mockResolvedValue([
      {
        imgUrl:
          'https://newartspace-images-dev.storage.yandexcloud.net/paintings/other.jpg?token=secret'
      }
    ])

    await expect(service.deleteUnusedImage(fileName)).resolves.toEqual({
      message: 'File deleted successfully'
    })
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      fileName,
      'paintings'
    )
  })

  it('deletes an unused canonical object under the object-key lock', async () => {
    const { service, storageService, paintingModel, sequelize, transaction } =
      createHarness()

    await expect(service.deleteUnusedImage(fileName)).resolves.toEqual({
      message: 'File deleted successfully'
    })
    expect(paintingModel.count).toHaveBeenCalledWith({
      where: {
        imgUrl:
          'https://storage.yandexcloud.net/newartspace-images-dev/paintings/unused.jpg'
      },
      transaction
    })
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      fileName,
      'paintings'
    )
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('lock_timeout'),
      expect.objectContaining({ transaction })
    )
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({
        replacements: { objectKey: 'paintings/unused.jpg' },
        transaction
      })
    )
    expect(sequelize.query.mock.invocationCallOrder[0]).toBeLessThan(
      sequelize.query.mock.invocationCallOrder[1]
    )
  })

  it('does not delete storage for an invalid legacy URL after DB deletion', async () => {
    const { service, storageService } = createHarness()
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    const rawUrl =
      'https://storage.yandexcloud.net/newartspace-images-dev/paintings/old.jpg?token=secret'
    const result = await (service as any).cleanupDeletedPaintingImages([
      {
        id: 42,
        imgUrl: rawUrl
      }
    ])

    expect(result).toEqual({
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 1
    })
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    const logText = errorSpy.mock.calls
      .map(([message]) => String(message))
      .join('\n')
    expect(logText).not.toContain('token=secret')
    expect(logText).not.toContain(rawUrl)
    errorSpy.mockRestore()
  })

  it('skips cleanup when a remaining legacy alias uses the deleted canonical filename', async () => {
    const { service, storageService, paintingModel } = createHarness()
    paintingModel.findAll.mockResolvedValue([
      {
        imgUrl:
          'https://newartspace-images-dev.storage.yandexcloud.net/paintings/unused.jpg?token=secret'
      }
    ])

    const result = await (service as any).cleanupDeletedPaintingImages([
      {
        id: 42,
        imgUrl:
          'https://storage.yandexcloud.net/newartspace-images-dev/paintings/unused.jpg'
      }
    ])

    expect(result).toEqual({
      skippedSharedImageCount: 1,
      storageCleanupErrorCount: 0
    })
    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })
})
