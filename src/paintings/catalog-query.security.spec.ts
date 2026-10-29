import { Sequelize as ModelSequelize } from 'sequelize-typescript'
import { Painting } from './models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { Attributes } from '../attributes/models/attributes.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { PaintingImage } from './models/painting-image.model'
import { BadRequestException } from '@nestjs/common'
import { Op, Sequelize } from 'sequelize'
import { PaintingsService } from './paintings.service'
import { ArtistsService } from '../artists/artists.service'

// Reintroducing raw filter interpolation or unvalidated sort fields must fail.
describe('catalog SQL boundary', () => {
  const paintings = { count: jest.fn(), findAll: jest.fn() }
  const artists = { findAndCountAll: jest.fn() }
  const service = new PaintingsService(
    paintings as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  )
  const artistService = new ArtistsService(
    artists as never,
    {} as never,
    {} as never
  )

  beforeEach(() => {
    jest.clearAllMocks()
    paintings.count.mockResolvedValue(2)
    paintings.findAll.mockResolvedValue([{ id: 7 }])
    artists.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
  })

  it.each(['materialsList', 'techniquesList', 'themesList', 'colorsList'])(
    'keeps %s values out of literal SQL in count and data',
    async (group) => {
      const value = "O'Brien\\blue') OR TRUE --"
      await service.getAllSortedPaintings(
        undefined,
        undefined,
        2,
        24,
        JSON.stringify({ [group]: [{ 12: value }] })
      )
      for (const options of [
        paintings.count.mock.calls[0][0],
        paintings.findAll.mock.calls[0][0]
      ]) {
        const conditions = options.where[Op.or]
        expect(conditions[1].id[Op.in].val).not.toContain(value)
        expect(conditions[1].id[Op.in].val).toContain(`IN (:${group})`)
        expect(options.replacements[group]).toEqual([value])
      }
      expect(paintings.findAll.mock.calls[0][0].offset).toBe(24)
    }
  )

  const invalidSorts = [
    '["title\\" DESC --","ASC"]',
    JSON.stringify(['title', 'DESC; SELECT 1']),
    JSON.stringify(['title', null]),
    JSON.stringify([{}, 'ASC']),
    JSON.stringify(['unknown', 'ASC']),
    JSON.stringify(['__proto__', 'ASC']),
    '{}',
    'null',
    '["id"]',
    'invalid'
  ]
  it.each(invalidSorts)(
    'rejects unsafe/malformed painting sort %s before SQL',
    async (sort) => {
      await expect(service.getAllSortedPaintings(sort)).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(paintings.count).not.toHaveBeenCalled()
      expect(paintings.findAll).not.toHaveBeenCalled()
    }
  )
  it.each(invalidSorts)(
    'rejects unsafe/malformed artist sort %s before SQL',
    async (sort) => {
      await expect(
        artistService.getAllSortedArtists(sort)
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(artists.findAndCountAll).not.toHaveBeenCalled()
    }
  )
  it('rejects an unsafe standalone direction', async () => {
    await expect(
      service.getAllSortedPaintings(undefined, 'ASC; SELECT 1' as never)
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      artistService.getAllSortedArtists(undefined, 'ASC; SELECT 1' as never)
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it.each([
    'null',
    '[]',
    '{',
    '{"materialsList":[null]}',
    '{"colorsList":[{"1":{}}]}',
    '{"themesList":"bad"}'
  ])('rejects malformed filters %s with 400 before SQL', async (filters) => {
    await expect(
      service.getAllSortedPaintings(
        undefined,
        undefined,
        undefined,
        undefined,
        filters
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(paintings.count).not.toHaveBeenCalled()
  })

  it.each([
    'title',
    'artStyle',
    'artist.artistName',
    'price',
    'createdAt',
    'isAdult',
    'isHidden',
    'id'
  ])('preserves supported painting sort %s and tie-breaker', async (field) => {
    await expect(
      service.getAllSortedPaintings(JSON.stringify([field, 'DESC']))
    ).resolves.toEqual({ data: [{ id: 7 }], total: 2 })
    const options = paintings.findAll.mock.calls[0][0]
    expect(options.order.at(-1)).toEqual([Sequelize.col('Painting.id'), 'ASC'])
    expect(options.order.at(-2)[1]).toBe('DESC')
    expect(options.where.isHidden).toBe(false)
  })

  it.each(['priority', 'id', 'artistName'])(
    'preserves supported artist sort %s and priorities',
    async (field) => {
      await artistService.getAllSortedArtists(
        JSON.stringify([field, 'DESC']),
        undefined,
        2,
        8,
        'А'
      )
      const options = artists.findAndCountAll.mock.calls[0][0]
      expect(options.order[0]).toEqual([Sequelize.col('priority'), 'DESC'])
      expect(options.order.at(-1)).toEqual([Sequelize.col('Artist.id'), 'ASC'])
      expect(options.order[1][1]).toBe('DESC')
      expect(options.offset).toBe(8)
      expect(options.where.artistName[Op.like]).toBe('А%')
      if (field === 'artistName')
        expect(options.order[1][0].val).toBe('"artistName" COLLATE "POSIX"')
    }
  )

  it.each([
    { materialsList: [{}] },
    { techniquesList: [{ 1: 'a', 2: 'b' }] },
    { artTypesList: 'bad' },
    { formatsList: [7] },
    { stylesList: null },
    { sizeList: [null] },
    { priceList: [] }
  ])('rejects malformed filter values %j', async (filters) => {
    await expect(
      service.getAllSortedPaintings(
        undefined,
        undefined,
        undefined,
        undefined,
        JSON.stringify(filters)
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(paintings.count).not.toHaveBeenCalled()
  })

  it('preserves legacy OR attributes, size OR, price, artStyle and hidden admin scope', async () => {
    await service.getAllSortedPaintings(
      '["price","ASC"]',
      undefined,
      1,
      24,
      JSON.stringify({
        materialsList: [{ 12: 'Масло' }],
        sizeList: ['Малый (до 30 × 30 см)'],
        priceList: 'до 10 000 руб.'
      }),
      'Традиции',
      undefined,
      true
    )
    const options = paintings.findAll.mock.calls[0][0]
    expect(options.where).not.toHaveProperty('isHidden')
    expect(options.where.artStyle).toBe('Традиции')
    expect(options.where.price).toEqual({ [Op.gte]: 0, [Op.lte]: 10000 })
    expect(options.where[Op.or][0]).toEqual({ material: ['Масло'] })
    expect(options.where[Op.or][2]).toEqual({
      height: { [Op.gte]: 0, [Op.lte]: 30 },
      width: { [Op.gte]: 0, [Op.lte]: 30 }
    })
    expect(options.order[0]).toEqual([Sequelize.col('Painting.price'), 'ASC'])
  })
})

// Use real models, query generation and replacement processing. Only the
// database transport is replaced: no DB, credentials or network is used.
describe('catalog generated PostgreSQL', () => {
  it('quotes attribute values in both generated queries before transport', async () => {
    const db = new ModelSequelize({
      dialect: 'postgres',
      logging: false,
      models: [Painting, Artist, Attributes, PaintingAttributes, PaintingImage]
    })
    const sql: string[] = []
    const manager = db.connectionManager as any
    const connect = jest.spyOn(manager, 'getConnection').mockResolvedValue({})
    const release = jest
      .spyOn(manager, 'releaseConnection')
      .mockResolvedValue(undefined)
    const run = jest
      .spyOn((db as any).dialect.Query.prototype, 'run')
      .mockImplementation(async (statement: string) => {
        sql.push(statement)
        return statement.includes('count(') ? { count: 0 } : []
      })
    try {
      const service = new PaintingsService(
        Painting,
        PaintingAttributes,
        {} as never,
        db,
        PaintingImage
      )
      await service.getAllSortedPaintings(
        '["title","ASC"]',
        undefined,
        1,
        24,
        JSON.stringify({
          materialsList: [{ 1: "O'Brien" }],
          colorsList: [{ 2: "blue') OR TRUE --" }],
          techniquesList: [{ 3: 'back\\slash' }, { 4: ':colorsList' }],
          themesList: [{ 5: "Artist's theme" }]
        })
      )
      expect(sql).toHaveLength(2)
      for (const statement of sql) {
        expect(statement).toContain("AND a.value IN ('O''Brien')")
        expect(statement).toContain("AND a.value IN ('blue'') OR TRUE --')")
        expect(statement).toContain(
          "AND a.value IN ('back\\slash', ':colorsList')"
        )
        expect(statement).toContain("AND a.value IN ('Artist''s theme')")
        expect(statement).not.toContain(':materialsList')
      }
      expect(sql[1]).toContain('"Painting"."title" COLLATE "POSIX" ASC')
    } finally {
      run.mockRestore()
      connect.mockRestore()
      release.mockRestore()
      await db.close()
    }
  })
})
