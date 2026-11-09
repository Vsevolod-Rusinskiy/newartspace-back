import { validateSync } from 'class-validator'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { CreatePaintingDto } from './dto/create-painting.dto'
import { UpdatePaintingDto } from './dto/update-painting.dto'
import { PaintingsService } from './paintings.service'

process.env.BUCKET_NAME = 'newartspace-images-dev'

describe.each([CreatePaintingDto, UpdatePaintingDto])(
  '%s study dimensions DTO',
  (DTO) => {
    it.each([true, [18], { value: 18 }])(
      'does not coerce %p into a measurement in the HTTP pipe',
      async (value) => {
        const pipe = new ValidationPipe({
          whitelist: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true }
        })
        await expect(
          pipe.transform(
            { imgUrl: 'cover', depth: value, diameter: value },
            { type: 'body', metatype: DTO }
          )
        ).rejects.toBeInstanceOf(BadRequestException)
      }
    )
    it('keeps nullable and fractional dimensions through whitelist validation', () => {
      const dto = Object.assign(new DTO(), {
        imgUrl: 'cover',
        depth: 2.5,
        diameter: 18.75
      })
      expect(validateSync(dto, { whitelist: true })).toEqual([])
      expect(dto).toMatchObject({ depth: 2.5, diameter: 18.75 })
      const cleared = Object.assign(new DTO(), {
        imgUrl: 'cover',
        depth: null,
        diameter: null
      })
      expect(validateSync(cleared, { whitelist: true })).toEqual([])
      expect(cleared).toMatchObject({ depth: null, diameter: null })
    })
    it.each([0, -1, NaN, Infinity, 'invalid', true])(
      'rejects invalid dimensions %p',
      (value) => {
        const dto = Object.assign(new DTO(), {
          imgUrl: 'cover',
          depth: value,
          diameter: value
        })
        const errors = validateSync(dto, { whitelist: true })
        expect(errors.map((error) => error.property).sort()).toEqual([
          'depth',
          'diameter'
        ])
      }
    )
  }
)

const makeService = (artStyle = 'Традиции', artType = 'Скульптура') => {
  const record = {
    id: 12,
    imgUrl:
      'https://storage.yandexcloud.net/newartspace-images-dev/paintings/cover.png',
    artStyle,
    artType,
    save: jest.fn()
  }
  const model = {
    build: jest.fn(() => record),
    findOne: jest.fn().mockResolvedValue(record),
    update: jest.fn()
  }
  const service = new PaintingsService(
    model as never,
    { create: jest.fn(), destroy: jest.fn() } as never,
    { fileExists: jest.fn().mockResolvedValue(true) } as never,
    {
      query: jest.fn(),
      transaction: jest.fn(async (callback) =>
        callback({ LOCK: { UPDATE: 'UPDATE' } })
      )
    } as never,
    { findAll: jest.fn().mockResolvedValue([]) } as never
  )
  return { service, record }
}

describe('study-only works and legacy editing', () => {
  it.each(['Скульптура', 'Фотография', 'Декоративно-прикладное искусство'])(
    'rejects a new %s outside Study',
    async (artType) => {
      const { service, record } = makeService()
      await expect(
        service.create({
          imgUrl: record.imgUrl,
          artType,
          artStyle: 'Современность'
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    }
  )
  it('allows an ordinary edit of a legacy sculpture outside Study', async () => {
    const { service, record } = makeService()
    await expect(
      service.update(12, {
        title: 'Renamed',
        artType: record.artType,
        artStyle: record.artStyle
      })
    ).resolves.toBe(record)
  })
  it('rejects moving a sculpture into another non-Study section', async () => {
    const { service } = makeService()
    await expect(
      service.update(12, { artStyle: 'Современность' })
    ).rejects.toBeInstanceOf(BadRequestException)
  })
  it('allows moving a legacy sculpture into Study', async () => {
    const { service, record } = makeService()
    await expect(service.update(12, { artStyle: 'Учеба' })).resolves.toBe(
      record
    )
  })
})
