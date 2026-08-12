import { EventsService } from './events.service'

describe('EventsService pagination order', () => {
  it('uses the event id as a stable tie-breaker', async () => {
    const eventModel = {
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 })
    }
    const service = new EventsService(
      eventModel as never,
      {} as never,
      {} as never
    )

    await service.getAllSortedEvents()

    const options = eventModel.findAndCountAll.mock.calls[0][0]
    const order = options.order as Array<[unknown, string]>

    expect(order[order.length - 1]).toEqual([
      expect.objectContaining({ col: 'Event.id' }),
      'ASC'
    ])
  })
})
