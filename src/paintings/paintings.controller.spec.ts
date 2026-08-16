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
    getAllSortedPaintings: jest.Mock
  }

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
      getAllSortedPaintings: jest.fn()
    }
    controller = new PaintingsController(
      paintingService as unknown as PaintingsService,
      {} as StorageService
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
})
