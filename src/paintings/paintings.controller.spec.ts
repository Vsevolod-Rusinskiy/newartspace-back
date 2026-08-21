jest.mock(
  'src/auth/guards/admin-jwt.guard',
  () => ({ AdminJwtGuard: class AdminJwtGuard {} }),
  { virtual: true }
)

import { PaintingsController } from './paintings.controller'
import { PaintingsService } from './paintings.service'
import { StorageService } from '../common/services/storage.service'

describe('PaintingsController response contracts', () => {
  let controller: PaintingsController
  let paintingService: {
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
    deleteMany: jest.Mock
    deleteUnusedImage: jest.Mock
    getAllSortedPaintings: jest.Mock
  }
  const publisher = { schedule: jest.fn() }

  const painting = {
    id: 301,
    title: 'Контракт ответа',
    imgUrl: 'https://example.com/painting.jpg',
    price: 100000,
    discount: 0,
    artistId: 12,
    isHidden: false
  }

  beforeEach(() => {
    paintingService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      deleteUnusedImage: jest.fn(),
      getAllSortedPaintings: jest.fn()
    }
    publisher.schedule.mockReset()
    controller = new PaintingsController(
      paintingService as unknown as PaintingsService,
      {} as StorageService,
      publisher as never
    )
  })

  it('returns the created painting itself instead of a list-style data wrapper', async () => {
    paintingService.create.mockResolvedValue(painting)

    const response = await controller.createPainting({
      title: painting.title,
      imgUrl: painting.imgUrl,
      price: painting.price,
      artistId: painting.artistId
    })

    expect(response).toEqual(painting)
    expect(response).not.toEqual({ data: painting })
  })

  it('returns the updated painting itself instead of a list-style data wrapper', async () => {
    const updatedPainting = { ...painting, title: 'Обновлённая картина' }
    paintingService.update.mockResolvedValue(updatedPainting)

    const response = await controller.updatePainting(
      { title: updatedPainting.title },
      String(painting.id)
    )

    expect(response).toEqual(updatedPainting)
    expect(response).not.toEqual({ data: updatedPainting })
  })

  it('keeps the data wrapper and HTTP query value for the paginated collection response', async () => {
    paintingService.getAllSortedPaintings.mockResolvedValue({
      data: [painting],
      total: 1
    })

    const response = await controller.getAllSortedPaintings(
      undefined,
      'ASC',
      '1',
      '9',
      undefined,
      undefined,
      undefined
    )

    expect(response).toEqual({
      data: [painting],
      total: 1,
      page: '1',
      pageCount: 1
    })
  })

  it('returns cleanup counters and publishes the validated id after single delete', async () => {
    paintingService.delete.mockResolvedValue({
      deletedPaintingIds: [301],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 1
    })

    const response = await controller.deletePainting('000301')

    expect(response).toEqual({
      message: 'Painting deleted successfully',
      cleanup: { skippedSharedImages: 0, errors: 1 }
    })
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'deleted',
      ids: [301]
    })
  })

  it('delegates unused image deletion to the painting service guard', async () => {
    paintingService.deleteUnusedImage.mockResolvedValue({
      message: 'File deleted successfully'
    })

    await expect(controller.deleteFile('unused.jpg')).resolves.toEqual({
      message: 'File deleted successfully'
    })
    expect(paintingService.deleteUnusedImage).toHaveBeenCalledWith('unused.jpg')
  })

  it('returns the numeric bulk count and publishes only validated unique ids', async () => {
    paintingService.deleteMany.mockResolvedValue({
      deletedPaintingIds: [401],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 1,
      storageCleanupErrorCount: 0
    })

    const response = await controller.deleteManyPaintings('[401,401]')

    expect(response).toEqual({
      message: 'Paintings deleted successfully',
      deletedCount: 1,
      cleanup: { skippedSharedImages: 1, errors: 0 }
    })
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'deleted',
      ids: [401]
    })
  })
})
