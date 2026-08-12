import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/sequelize'
import { NotFoundException } from '@nestjs/common'
import { PaintingsService } from './paintings.service'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { StorageService } from '../common/services/storage.service'

describe('PaintingsService public visibility', () => {
  let service: PaintingsService
  let paintingModel: {
    findOne: jest.Mock
    findAll: jest.Mock
    count: jest.Mock
  }

  beforeEach(async () => {
    paintingModel = {
      findOne: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaintingsService,
        { provide: getModelToken(Painting), useValue: paintingModel },
        {
          provide: getModelToken(PaintingAttributes),
          useValue: { destroy: jest.fn(), create: jest.fn() }
        },
        { provide: StorageService, useValue: { deleteFile: jest.fn() } }
      ]
    }).compile()

    service = module.get(PaintingsService)
  })

  it('excludes hidden paintings from the public catalog and its total', async () => {
    await service.getAllSortedPaintings()

    expect(paintingModel.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false })
      })
    )
    expect(paintingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false })
      })
    )
  })

  it('uses the painting id as a stable pagination tie-breaker', async () => {
    await service.getAllSortedPaintings()

    const options = paintingModel.findAll.mock.calls[0][0]
    const order = options.order as Array<[unknown, string]>

    expect(order[order.length - 1]).toEqual([
      expect.objectContaining({ col: 'Painting.id' }),
      'ASC'
    ])
  })

  it('returns the same not-found result for a hidden public direct link', async () => {
    paintingModel.findOne.mockResolvedValue(null)

    await expect(service.findPublicOne('18')).rejects.toBeInstanceOf(
      NotFoundException
    )
    expect(paintingModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '18', isHidden: false } })
    )
  })

  it('keeps hidden paintings available to an administrative detail read', async () => {
    paintingModel.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 18,
        isHidden: true,
        artist: { artistName: 'Автор' }
      })
    })

    await expect(service.findOne('18')).resolves.toMatchObject({
      id: 18,
      isHidden: true,
      author: 'Автор'
    })
    expect(paintingModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '18' } })
    )
  })

  it('excludes hidden paintings from public batch reads', async () => {
    await service.findMany('18,19')

    expect(paintingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false })
      })
    )
  })

  it('loads similar paintings from the public source and visible candidates', async () => {
    paintingModel.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 18,
        artistId: 1,
        artStyle: 'Современность',
        artist: { artistName: 'Автор' },
        attributes: []
      })
    })
    paintingModel.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 19,
          artistId: 1,
          artStyle: 'Современность',
          priority: 1,
          artist: { artistName: 'Другой автор' },
          attributes: []
        })
      }
    ])

    await expect(service.findSimilar('18', 5)).resolves.toEqual([
      expect.objectContaining({ id: 19, author: 'Другой автор' })
    ])
    expect(paintingModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '18', isHidden: false } })
    )
    expect(paintingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false })
      })
    )
  })
})
