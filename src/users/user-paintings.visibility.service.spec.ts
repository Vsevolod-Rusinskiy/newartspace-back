import { UserPaintingsService } from './user-paintings.service'

describe('UserPaintingsService public visibility', () => {
  it('excludes hidden paintings from favourites and cart associations', async () => {
    const userPaintingModel = {
      findAll: jest.fn().mockResolvedValue([])
    }
    const service = new UserPaintingsService(
      userPaintingModel as never,
      {} as never
    )

    await service.getUserPaintings(7)

    expect(userPaintingModel.findAll).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: [
        expect.objectContaining({
          where: { isHidden: false },
          required: true
        })
      ]
    })
  })

  it('does not persist hidden or missing painting ids from a direct update', async () => {
    const userPaintingModel = {
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
      findAll: jest.fn().mockResolvedValue([])
    }
    const paintingModel = {
      findAll: jest.fn().mockResolvedValue([{ id: 10 }])
    }
    const service = new UserPaintingsService(
      userPaintingModel as never,
      paintingModel as never
    )

    await service.updateUserPaintings(7, {
      favorites: [10, 11],
      cart: [11]
    })

    expect(paintingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false })
      })
    )
    expect(userPaintingModel.bulkCreate).toHaveBeenCalledWith([
      { userId: 7, paintingId: 10, type: 'favorite' }
    ])
  })
})
