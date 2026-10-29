import { Op } from 'sequelize'
import { PaintingsService } from './paintings.service'

describe('catalog price filter compatibility with the public frontend', () => {
  it.each(['до 10 000 руб.', ['до 10 000 руб.']])(
    'applies the same price bounds for %j',
    async (priceList) => {
      const model = {
        findAll: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      }
      const service = new PaintingsService(
        model as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
      )
      await expect(
        service.getAllSortedPaintings(
          undefined,
          undefined,
          1,
          9,
          JSON.stringify({ priceList })
        )
      ).resolves.toEqual({ data: [], total: 0 })
      for (const options of [
        model.count.mock.calls[0][0],
        model.findAll.mock.calls[0][0]
      ]) {
        expect(options.where.price).toEqual({ [Op.gte]: 0, [Op.lte]: 10000 })
      }
    }
  )
})
