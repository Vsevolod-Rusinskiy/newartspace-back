jest.mock(
  'src/auth/guards/admin-jwt.guard',
  () => ({ AdminJwtGuard: class AdminJwtGuard {} }),
  { virtual: true }
)
jest.mock('../../auth/guards/admin-jwt.guard', () => ({
  AdminJwtGuard: class AdminJwtGuard {}
}))

import { AboutController } from '../../about/about.controller'
import { AboutService } from '../../about/about.service'
import { Test } from '@nestjs/testing'
import { ArtistsController } from '../../artists/artists.controller'
import { ArtistsService } from '../../artists/artists.service'
import { CacheRevalidationPublisher } from './cache-revalidation.publisher'
import { StorageService } from '../services/storage.service'
import { EventPhotosController } from '../../events/event-photos.controller'
import { EventPhotosService } from '../../events/event-photos.service'
import { EventsController } from '../../events/events.controller'
import { EventsService } from '../../events/events.service'
import { PaintingsController } from '../../paintings/paintings.controller'
import { PaintingsService } from '../../paintings/paintings.service'
import { WelcomeController } from '../../welcome/welcome.controller'
import { WelcomeService } from '../../welcome/welcome.service'
import { WorkingHoursController } from '../../working-hours/working-hours.controller'
import { WorkingHoursService } from '../../working-hours/working-hours.service'

type PublisherMock = CacheRevalidationPublisher & { schedule: jest.Mock }

describe('Cache revalidation controller hooks', () => {
  const storageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn()
  } as unknown as StorageService

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schedules the created painting with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 101, title: 'Painting' }
    service.create.mockResolvedValue(created)
    const controller = new PaintingsController(
      service as unknown as PaintingsService,
      storageService,
      publisher
    )

    const response = await controller.createPainting({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'created',
      ids: [101]
    })
  })

  it('schedules the updated painting with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 101, title: 'Updated painting' }
    service.update.mockResolvedValue(updated)
    const controller = new PaintingsController(
      service as unknown as PaintingsService,
      storageService,
      publisher
    )

    const response = await controller.updatePainting({} as never, '301')

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'updated',
      ids: ['301']
    })
  })

  it('schedules the deleted painting with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new PaintingsController(
      service as unknown as PaintingsService,
      storageService,
      publisher
    )

    const response = await controller.deletePainting('301')

    expect(response).toEqual({ message: 'Painting deleted successfully' })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'deleted',
      ids: ['301']
    })
  })

  it('schedules parsed painting ids after a successful bulk delete', async () => {
    const service = { deleteMany: jest.fn().mockResolvedValue(2) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new PaintingsController(
      service as unknown as PaintingsService,
      storageService,
      publisher
    )

    const response = await controller.deleteManyPaintings('["401", "402"]')

    expect(response).toEqual({
      message: 'Paintings deleted successfully',
      deletedCount: 2
    })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'painting',
      action: 'deleted',
      ids: ['401', '402']
    })
  })

  it('does not schedule a painting event when the mutation rejects', async () => {
    const service = { create: jest.fn().mockRejectedValue(new Error('failed')) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new PaintingsController(
      service as unknown as PaintingsService,
      storageService,
      publisher
    )

    await expect(controller.createPainting({} as never)).rejects.toThrow(
      'failed'
    )

    expect(publisher.schedule).not.toHaveBeenCalled()
  })

  it('does not schedule a painting event for storage-only routes', async () => {
    const publisher = { schedule: jest.fn() } as PublisherMock
    const storage = {
      uploadFile: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
      deleteFile: jest.fn().mockResolvedValue(undefined)
    }
    const controller = new PaintingsController(
      {} as PaintingsService,
      storage as unknown as StorageService,
      publisher
    )

    const uploadResponse = await controller.uploadFile({
      size: 100,
      originalname: 'image.jpg',
      buffer: Buffer.from('image')
    } as Express.Multer.File)
    const deleteResponse = await controller.deleteFile('image.jpg')

    expect(uploadResponse).toEqual({ imgUrl: 'https://example.com/image.jpg' })
    expect(deleteResponse).toEqual({ message: 'File deleted successfully' })
    expect(publisher.schedule).not.toHaveBeenCalled()
  })

  it('schedules the created artist with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 102, name: 'Artist' }
    service.create.mockResolvedValue(created)
    const controller = new ArtistsController(
      service as unknown as ArtistsService,
      storageService,
      publisher
    )

    const response = await controller.createArtist({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'artist',
      action: 'created',
      ids: [102]
    })
  })

  it('schedules the updated artist with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 102, name: 'Updated artist' }
    service.update.mockResolvedValue(updated)
    const controller = new ArtistsController(
      service as unknown as ArtistsService,
      storageService,
      publisher
    )

    const response = await controller.updateArtist({} as never, '302')

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'artist',
      action: 'updated',
      ids: ['302']
    })
  })

  it('schedules the deleted artist with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new ArtistsController(
      service as unknown as ArtistsService,
      storageService,
      publisher
    )

    const response = await controller.deleteArtist('302')

    expect(response).toEqual({ message: 'Artist deleted successfully' })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'artist',
      action: 'deleted',
      ids: ['302']
    })
  })

  it('schedules parsed artist ids after a successful bulk delete', async () => {
    const service = { deleteMany: jest.fn().mockResolvedValue(2) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new ArtistsController(
      service as unknown as ArtistsService,
      storageService,
      publisher
    )

    const response = await controller.deleteManyArtists('["403", "404"]')

    expect(response).toEqual({
      message: 'Artists deleted successfully',
      deletedCount: 2
    })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'artist',
      action: 'deleted',
      ids: ['403', '404']
    })
  })

  it('schedules the created event with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 103, title: 'Event' }
    service.create.mockResolvedValue(created)
    const controller = new EventsController(
      service as unknown as EventsService,
      storageService,
      publisher
    )

    const response = await controller.createEvent({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event',
      action: 'created',
      ids: [103]
    })
  })

  it('schedules the updated event with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 103, title: 'Updated event' }
    service.update.mockResolvedValue(updated)
    const controller = new EventsController(
      service as unknown as EventsService,
      storageService,
      publisher
    )

    const response = await controller.updateEvent({} as never, '303')

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event',
      action: 'updated',
      ids: ['303']
    })
  })

  it('schedules the deleted event with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new EventsController(
      service as unknown as EventsService,
      storageService,
      publisher
    )

    const response = await controller.deleteEvent('303')

    expect(response).toEqual({ message: 'Event deleted successfully' })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event',
      action: 'deleted',
      ids: ['303']
    })
  })

  it('schedules parsed event ids after a successful bulk delete', async () => {
    const service = { deleteMany: jest.fn().mockResolvedValue(2) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new EventsController(
      service as unknown as EventsService,
      storageService,
      publisher
    )

    const response = await controller.deleteManyArtists('["405", "406"]')

    expect(response).toEqual({
      message: 'Events deleted successfully',
      deletedCount: 2
    })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event',
      action: 'deleted',
      ids: ['405', '406']
    })
  })

  it('schedules the created event photo with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 104, imageUrl: 'photo.jpg' }
    service.create.mockResolvedValue(created)
    const controller = new EventPhotosController(
      service as unknown as EventPhotosService,
      storageService,
      publisher
    )

    const response = await controller.create({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event-photo',
      action: 'created',
      ids: [104]
    })
  })

  it('schedules the updated event photo with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 104, imageUrl: 'updated-photo.jpg' }
    service.update.mockResolvedValue(updated)
    const controller = new EventPhotosController(
      service as unknown as EventPhotosService,
      storageService,
      publisher
    )

    const response = await controller.update('304', {} as never)

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event-photo',
      action: 'updated',
      ids: ['304']
    })
  })

  it('schedules the deleted event photo with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new EventPhotosController(
      service as unknown as EventPhotosService,
      storageService,
      publisher
    )

    const response = await controller.remove('304')

    expect(response).toEqual({ success: true })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'event-photo',
      action: 'deleted',
      ids: ['304']
    })
  })

  it('schedules the created about entry with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 105, title: 'About' }
    service.create.mockResolvedValue(created)
    const controller = new AboutController(
      service as unknown as AboutService,
      storageService,
      publisher
    )

    const response = await controller.create({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'about',
      action: 'created',
      ids: [105]
    })
  })

  it('schedules the updated about entry with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 105, title: 'Updated about' }
    service.update.mockResolvedValue(updated)
    const controller = new AboutController(
      service as unknown as AboutService,
      storageService,
      publisher
    )

    const response = await controller.update('305', {} as never)

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'about',
      action: 'updated',
      ids: ['305']
    })
  })

  it('schedules the deleted about entry with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new AboutController(
      service as unknown as AboutService,
      storageService,
      publisher
    )

    const response = await controller.remove('305')

    expect(response).toEqual({ success: true })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'about',
      action: 'deleted',
      ids: ['305']
    })
  })

  it('schedules the created working-hours entry with its returned id', async () => {
    const service = { create: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const created = { id: 106, day: 'Monday' }
    service.create.mockResolvedValue(created)
    const controller = new WorkingHoursController(
      service as unknown as WorkingHoursService,
      publisher
    )

    const response = await controller.create({} as never)

    expect(response).toBe(created)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'working-hours',
      action: 'created',
      ids: [106]
    })
  })

  it('schedules the updated working-hours entry with its route id', async () => {
    const service = { update: jest.fn() }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const updated = { id: 106, day: 'Tuesday' }
    service.update.mockResolvedValue(updated)
    const controller = new WorkingHoursController(
      service as unknown as WorkingHoursService,
      publisher
    )

    const response = await controller.update('306', {} as never)

    expect(response).toBe(updated)
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'working-hours',
      action: 'updated',
      ids: ['306']
    })
  })

  it('schedules the deleted working-hours entry with its route id', async () => {
    const service = { delete: jest.fn().mockResolvedValue(undefined) }
    const publisher = { schedule: jest.fn() } as PublisherMock
    const controller = new WorkingHoursController(
      service as unknown as WorkingHoursService,
      publisher
    )

    const response = await controller.remove('306')

    expect(response).toEqual({ success: true })
    expect(publisher.schedule).toHaveBeenCalledTimes(1)
    expect(publisher.schedule).toHaveBeenCalledWith({
      entity: 'working-hours',
      action: 'deleted',
      ids: ['306']
    })
  })

  it('keeps welcome mutations independent of cache-revalidation publishing', async () => {
    const service = { create: jest.fn() }
    const welcome = { id: 107, title: 'Welcome' }
    service.create.mockResolvedValue(welcome)
    const module = await Test.createTestingModule({
      controllers: [WelcomeController],
      providers: [
        {
          provide: WelcomeService,
          useValue: service
        }
      ]
    }).compile()
    const controller = module.get(WelcomeController)

    const response = await controller.create({} as never)

    expect(response).toBe(welcome)
  })
})
