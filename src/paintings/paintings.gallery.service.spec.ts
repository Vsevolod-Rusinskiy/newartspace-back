import { BadRequestException } from '@nestjs/common'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { PaintingImage } from './models/painting-image.model'
import { PaintingsService } from './paintings.service'

process.env.BUCKET_NAME = 'newartspace-images'

const url = (name: string) =>
  `https://storage.yandexcloud.net/newartspace-images/paintings/${name}.jpg`

describe('PaintingsService gallery', () => {
  const makeService = (existingImages: Array<{ imgUrl: string }> = []) => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } }
    const imageModel = {
      create: jest.fn(),
      destroy: jest.fn(),
      findAll: jest.fn().mockResolvedValue(existingImages),
      count: jest.fn().mockResolvedValue(0)
    }
    const painting = {
      id: 12,
      imgUrl: url('cover'),
      save: jest.fn(),
      toJSON: () => ({ id: 12, imgUrl: url('cover'), images: [] })
    }
    const paintingModel = {
      build: jest.fn(() => painting),
      findOne: jest.fn().mockResolvedValue(painting),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    }
    const service = new (PaintingsService as any)(
      paintingModel as unknown as typeof Painting,
      {
        create: jest.fn(),
        destroy: jest.fn()
      } as unknown as typeof PaintingAttributes,
      { fileExists: jest.fn().mockResolvedValue(true), deleteFile: jest.fn() },
      {
        transaction: jest.fn(async (callback) => callback(transaction)),
        query: jest.fn()
      },
      imageModel as unknown as typeof PaintingImage
    ) as PaintingsService
    return { service, imageModel, paintingModel }
  }

  it('creates ordered additional image rows after validating every URL', async () => {
    const { service, imageModel } = makeService()
    await service.create({
      imgUrl: url('cover'),
      additionalImageUrls: [url('first'), url('second')]
    })
    expect(imageModel.create).toHaveBeenNthCalledWith(
      1,
      { paintingId: 12, imgUrl: url('first'), position: 0 },
      expect.anything()
    )
    expect(imageModel.create).toHaveBeenNthCalledWith(
      2,
      { paintingId: 12, imgUrl: url('second'), position: 1 },
      expect.anything()
    )
  })

  it('rejects duplicate and cover URLs before storing gallery rows', async () => {
    const { service, imageModel, paintingModel } = makeService()
    await expect(
      service.create({
        imgUrl: url('cover'),
        additionalImageUrls: [url('cover')]
      })
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.create({
        imgUrl: url('cover'),
        additionalImageUrls: [url('same'), url('same')]
      })
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(imageModel.create).not.toHaveBeenCalled()
    expect(paintingModel.build).not.toHaveBeenCalled()
  })

  it('loads ordered images for both private and public detail lookups', async () => {
    const { service, paintingModel } = makeService()

    await service.findOne('12')
    await service.findPublicOne('12')

    expect(paintingModel.findOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: '12' },
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'images',
            separate: true,
            order: [['position', 'ASC']]
          })
        ])
      })
    )
    expect(paintingModel.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: '12', isHidden: false } })
    )
  })

  it('keeps gallery rows unchanged when PATCH omits additionalImageUrls', async () => {
    const { service, imageModel } = makeService([{ imgUrl: url('old') }])
    await service.update(12, { title: 'renamed' })
    expect(imageModel.destroy).not.toHaveBeenCalled()
    expect(imageModel.create).not.toHaveBeenCalled()
  })

  it('clears gallery rows and cleans only removed URLs after PATCH []', async () => {
    const { service, imageModel } = makeService([
      { imgUrl: url('old-a') },
      { imgUrl: url('old-b') }
    ])
    const cleanup = jest
      .spyOn(service as any, 'cleanupDeletedPaintingImages')
      .mockResolvedValue({
        skippedSharedImageCount: 0,
        storageCleanupErrorCount: 0
      })
    await service.update(12, { additionalImageUrls: [] })
    expect(imageModel.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paintingId: 12 } })
    )
    expect(imageModel.create).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledWith([
      { id: 12, imgUrl: url('old-a') },
      { id: 12, imgUrl: url('old-b') }
    ])
  })

  it('replaces gallery rows in requested order and cleans only removed URLs', async () => {
    const { service, imageModel } = makeService([
      { imgUrl: url('old-a') },
      { imgUrl: url('kept') }
    ])
    const cleanup = jest
      .spyOn(service as any, 'cleanupDeletedPaintingImages')
      .mockResolvedValue({
        skippedSharedImageCount: 0,
        storageCleanupErrorCount: 0
      })
    await service.update(12, { additionalImageUrls: [url('kept'), url('new')] })
    expect(imageModel.create).toHaveBeenNthCalledWith(
      1,
      { paintingId: 12, imgUrl: url('kept'), position: 0 },
      expect.anything()
    )
    expect(imageModel.create).toHaveBeenNthCalledWith(
      2,
      { paintingId: 12, imgUrl: url('new'), position: 1 },
      expect.anything()
    )
    expect(cleanup).toHaveBeenCalledWith([{ id: 12, imgUrl: url('old-a') }])
  })

  it('rejects replacing the cover with an existing gallery URL', async () => {
    const { service } = makeService([{ imgUrl: url('gallery') }])
    await expect(
      service.update(12, { imgUrl: url('gallery') })
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
