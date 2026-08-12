import { ArtistsService } from './artists.service'

describe('ArtistsService pagination order', () => {
  it('uses the artist id as a stable tie-breaker', async () => {
    const artistModel = {
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 })
    }
    const service = new ArtistsService(
      artistModel as never,
      {} as never,
      {} as never
    )

    await service.getAllSortedArtists()

    const options = artistModel.findAndCountAll.mock.calls[0][0]
    const order = options.order as Array<[unknown, string]>

    expect(order[order.length - 1]).toEqual([
      expect.objectContaining({ col: 'Artist.id' }),
      'ASC'
    ])
  })
})
