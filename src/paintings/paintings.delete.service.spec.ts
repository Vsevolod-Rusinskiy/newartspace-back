import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { PaintingsService } from './paintings.service'

process.env.BUCKET_NAME = 'newartspace-images-dev'

const imageUrl =
  'https://storage.yandexcloud.net/newartspace-images-dev/paintings/delete-me.jpg'

interface HarnessOptions {
  found?: boolean
  attributesError?: Error
  paintingError?: Error
  countResult?: number
  countError?: Error
  storageError?: Error
  commitError?: Error
}

const createHarness = (options: HarnessOptions = {}) => {
  const sequence: string[] = []
  const transaction: {
    LOCK: { UPDATE: string }
    finished?: string
    commit: jest.Mock
    rollback: jest.Mock
  } = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn(async () => {
      sequence.push('commit')
      transaction.finished = 'commit'
      if (options.commitError) throw options.commitError
    }),
    rollback: jest.fn(async () => {
      sequence.push('rollback')
    })
  }
  const painting = {
    id: 21,
    imgUrl: imageUrl,
    artist: null,
    toJSON() {
      return { id: this.id, imgUrl: this.imgUrl, artist: this.artist }
    },
    destroy: jest.fn(async () => {
      sequence.push('painting')
      if (options.paintingError) throw options.paintingError
    })
  }
  const paintingModel = {
    findOne: jest.fn(async () => {
      sequence.push('find')
      return options.found === false ? null : painting
    }),
    findAll: jest.fn(async () => {
      sequence.push('find')
      return options.found === false ? [] : [painting]
    }),
    count: jest.fn(async () => {
      sequence.push('count-references')
      if (options.countError) throw options.countError
      return options.countResult || 0
    })
  }
  const paintingAttributesModel = {
    destroy: jest.fn(async () => {
      sequence.push('attributes')
      if (options.attributesError) throw options.attributesError
      return 2
    })
  }
  const storageService = {
    deleteFile: jest.fn(async () => {
      sequence.push('storage')
      if (options.storageError) throw options.storageError
    })
  }
  const sequelize = {
    transaction: jest.fn(async (callback?: (value: unknown) => unknown) =>
      callback ? callback(transaction) : transaction
    ),
    query: jest.fn()
  }
  const service = new (PaintingsService as any)(
    paintingModel as unknown as typeof Painting,
    paintingAttributesModel as unknown as typeof PaintingAttributes,
    storageService,
    sequelize
  ) as PaintingsService

  return {
    painting,
    paintingModel,
    paintingAttributesModel,
    storageService,
    sequelize,
    transaction,
    sequence,
    service
  }
}

interface BulkHarnessOptions {
  foundIds?: number[]
  sharedImage?: boolean
  countResult?: number
  failingPaintingId?: number
  paintingError?: Error
}

const createBulkHarness = (options: BulkHarnessOptions = {}) => {
  const sequence: string[] = []
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn(async () => {
      sequence.push('commit')
    }),
    rollback: jest.fn(async () => {
      sequence.push('rollback')
    })
  }
  const makePainting = (id: number) => ({
    id,
    imgUrl: options.sharedImage
      ? imageUrl
      : `https://storage.yandexcloud.net/newartspace-images-dev/paintings/delete-${id}.jpg`,
    artist: null,
    toJSON() {
      return { id: this.id, imgUrl: this.imgUrl, artist: this.artist }
    },
    destroy: jest.fn(async () => {
      sequence.push(`painting-${id}`)
      if (options.failingPaintingId === id && options.paintingError) {
        throw options.paintingError
      }
    })
  })
  const foundIds = options.foundIds || [21, 22]
  const paintings = foundIds.map(makePainting)
  const paintingModel = {
    findOne: jest.fn(async () => paintings[0] || null),
    findAll: jest.fn(async () => {
      sequence.push('find-many')
      return paintings
    }),
    count: jest.fn(async () => {
      sequence.push('count-references')
      return options.countResult || 0
    })
  }
  const paintingAttributesModel = {
    destroy: jest.fn(async () => {
      sequence.push('attributes')
      return 3
    })
  }
  const storageService = {
    deleteFile: jest.fn(async (fileName: string) => {
      sequence.push(`storage-${fileName}`)
    })
  }
  const sequelize = {
    transaction: jest.fn(async (callback?: (value: unknown) => unknown) =>
      callback ? callback(transaction) : transaction
    ),
    query: jest.fn()
  }
  const service = new (PaintingsService as any)(
    paintingModel as unknown as typeof Painting,
    paintingAttributesModel as unknown as typeof PaintingAttributes,
    storageService,
    sequelize
  ) as PaintingsService

  return {
    paintings,
    paintingModel,
    paintingAttributesModel,
    storageService,
    sequelize,
    transaction,
    sequence,
    service
  }
}

describe('PaintingsService.delete', () => {
  it('commits the database deletion before cleaning the unreferenced image', async () => {
    const {
      painting,
      paintingModel,
      paintingAttributesModel,
      storageService,
      sequelize,
      transaction,
      sequence,
      service
    } = createHarness()

    const result = await service.delete('21')

    expect(result).toEqual({
      deletedPaintingIds: [21],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 0
    })
    expect(sequence).toEqual([
      'find',
      'attributes',
      'painting',
      'commit',
      'count-references',
      'find',
      'storage'
    ])
    expect(paintingAttributesModel.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ transaction })
    )
    expect(paintingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction,
        lock: transaction.LOCK.UPDATE
      })
    )
    expect(sequelize.query.mock.invocationCallOrder[0]).toBeLessThan(
      paintingModel.findAll.mock.invocationCallOrder[0]
    )
    expect(painting.destroy).toHaveBeenCalledWith({ transaction })
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'delete-me.jpg',
      'paintings'
    )
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({
        replacements: { objectKey: 'paintings/delete-me.jpg' },
        transaction
      })
    )
    expect(paintingModel.count).toHaveBeenCalledWith(
      expect.objectContaining({ transaction })
    )
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('rolls back without touching storage when the painting is missing', async () => {
    const {
      painting,
      paintingAttributesModel,
      storageService,
      transaction,
      sequence,
      service
    } = createHarness({ found: false })

    await expect(service.delete('21')).rejects.toBeInstanceOf(NotFoundException)

    expect(sequence).toEqual(['find', 'rollback'])
    expect(paintingAttributesModel.destroy).not.toHaveBeenCalled()
    expect(painting.destroy).not.toHaveBeenCalled()
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.commit).not.toHaveBeenCalled()
  })

  it('rolls back without touching storage when attribute deletion fails', async () => {
    const { storageService, transaction, sequence, service } = createHarness({
      attributesError: new Error('attribute delete failed')
    })

    await expect(service.delete('21')).rejects.toThrow(
      'attribute delete failed'
    )

    expect(sequence).toEqual(['find', 'attributes', 'rollback'])
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.commit).not.toHaveBeenCalled()
  })

  it('returns conflict and rolls back when another record references the painting', async () => {
    const foreignKeyError = Object.assign(new Error('order reference'), {
      name: 'SequelizeForeignKeyConstraintError'
    })
    const { storageService, transaction, sequence, service } = createHarness({
      paintingError: foreignKeyError
    })

    await expect(service.delete('21')).rejects.toBeInstanceOf(ConflictException)

    expect(sequence).toEqual(['find', 'attributes', 'painting', 'rollback'])
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.commit).not.toHaveBeenCalled()
  })

  it('keeps an image that is still referenced by another painting', async () => {
    const { storageService, transaction, sequence, service } = createHarness({
      countResult: 1
    })

    await expect(service.delete('21')).resolves.toEqual({
      deletedPaintingIds: [21],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 1,
      storageCleanupErrorCount: 0
    })

    expect(sequence).toEqual([
      'find',
      'attributes',
      'painting',
      'commit',
      'count-references'
    ])
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('keeps the committed deletion successful when the reference check fails', async () => {
    const { storageService, transaction, sequence, service } = createHarness({
      countError: new Error('reference check failed')
    })

    await expect(service.delete('21')).resolves.toEqual({
      deletedPaintingIds: [21],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 1
    })

    expect(sequence).toEqual([
      'find',
      'attributes',
      'painting',
      'commit',
      'count-references'
    ])
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('keeps the committed deletion successful when Object Storage fails', async () => {
    const { transaction, sequence, service } = createHarness({
      storageError: new Error('storage unavailable')
    })

    await expect(service.delete('21')).resolves.toEqual({
      deletedPaintingIds: [21],
      deletedPaintingCount: 1,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 1
    })

    expect(sequence).toEqual([
      'find',
      'attributes',
      'painting',
      'commit',
      'count-references',
      'find',
      'storage'
    ])
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('preserves a commit failure without masking it with rollback', async () => {
    const commitError = new Error('commit outcome unknown')
    const { storageService, transaction, sequence, service } = createHarness({
      commitError
    })

    await expect(service.delete('21')).rejects.toBe(commitError)

    expect(sequence).toEqual(['find', 'attributes', 'painting', 'commit'])
    expect(transaction.rollback).not.toHaveBeenCalled()
    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })

  it('logs enough structured context to recover a post-commit orphan', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    const { service } = createHarness({
      storageError: new Error('storage unavailable')
    })

    await service.delete('21')

    const cleanupLog = errorSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('painting_image_cleanup_failed'))
    expect(JSON.parse(cleanupLog)).toMatchObject({
      event: 'painting_image_cleanup_failed',
      deletedPaintingIds: [21],
      phase: 'storage_delete',
      objectKey: 'paintings/delete-me.jpg',
      category: 'paintings',
      errorName: 'Error',
      errorMessage: 'storage unavailable'
    })

    errorSpy.mockRestore()
  })
})

describe('PaintingsService.deleteMany', () => {
  it.each([
    ['invalid JSON', 'not-json'],
    ['non-array JSON', '{"id":21}'],
    ['empty array', '[]'],
    ['zero id', '[0]'],
    ['negative id', '[-1]'],
    ['decimal id', '[21.5]'],
    ['non-numeric id', '["painting"]'],
    ['boolean id', '[true]'],
    ['nested-array id', '[[21]]'],
    ['whitespace id', '[" 21 "]'],
    ['exponent string id', '["1e2"]'],
    ['unsafe integer id', '[9007199254740992]']
  ])('rejects %s before starting a transaction', async (_label, ids) => {
    const { sequelize, service } = createBulkHarness()

    await expect(service.deleteMany(ids)).rejects.toBeInstanceOf(
      BadRequestException
    )

    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it('accepts only explicit decimal digit strings within the safe range', async () => {
    const { service } = createBulkHarness({ foundIds: [21] })

    await expect(service.deleteMany('["21"]')).resolves.toMatchObject({
      deletedPaintingIds: [21]
    })
  })

  it('rejects more than 100 unique ids before starting a transaction', async () => {
    const { sequelize, service } = createBulkHarness()
    const ids = Array.from({ length: 101 }, (_, index) => index + 1)

    await expect(
      service.deleteMany(JSON.stringify(ids))
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(sequelize.transaction).not.toHaveBeenCalled()
  })

  it('deletes each normalized id in one transaction before image cleanup', async () => {
    const { storageService, transaction, sequence, service } =
      createBulkHarness()

    await expect(service.deleteMany('[21,22,21]')).resolves.toEqual({
      deletedPaintingIds: [21, 22],
      deletedPaintingCount: 2,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 0
    })

    expect(sequence).toEqual([
      'find-many',
      'attributes',
      'painting-21',
      'painting-22',
      'commit',
      'count-references',
      'find-many',
      'storage-delete-21.jpg',
      'count-references',
      'find-many',
      'storage-delete-22.jpg'
    ])
    expect(storageService.deleteFile).toHaveBeenCalledTimes(2)
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('rolls back the whole set when any requested id is missing', async () => {
    const {
      paintingAttributesModel,
      storageService,
      transaction,
      sequence,
      service
    } = createBulkHarness({ foundIds: [21] })

    await expect(service.deleteMany('[21,22]')).rejects.toBeInstanceOf(
      NotFoundException
    )

    expect(sequence).toEqual(['find-many', 'rollback'])
    expect(paintingAttributesModel.destroy).not.toHaveBeenCalled()
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.commit).not.toHaveBeenCalled()
  })

  it('rolls back the whole set when one painting has a foreign-key reference', async () => {
    const foreignKeyError = Object.assign(new Error('order reference'), {
      name: 'SequelizeForeignKeyConstraintError'
    })
    const { storageService, transaction, sequence, service } =
      createBulkHarness({
        failingPaintingId: 22,
        paintingError: foreignKeyError
      })

    await expect(service.deleteMany('[21,22]')).rejects.toBeInstanceOf(
      ConflictException
    )

    expect(sequence).toEqual([
      'find-many',
      'attributes',
      'painting-21',
      'painting-22',
      'rollback'
    ])
    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(transaction.commit).not.toHaveBeenCalled()
  })

  it('cleans a duplicated image URL at most once after bulk commit', async () => {
    const { paintingModel, storageService, service } = createBulkHarness({
      sharedImage: true
    })

    await expect(service.deleteMany('[21,22]')).resolves.toEqual({
      deletedPaintingIds: [21, 22],
      deletedPaintingCount: 2,
      skippedSharedImageCount: 0,
      storageCleanupErrorCount: 0
    })

    expect(paintingModel.count).toHaveBeenCalledTimes(1)
    expect(storageService.deleteFile).toHaveBeenCalledTimes(1)
  })

  it('keeps a bulk image URL that is still referenced after commit', async () => {
    const { paintingModel, storageService, service } = createBulkHarness({
      sharedImage: true,
      countResult: 1
    })

    await expect(service.deleteMany('[21,22]')).resolves.toMatchObject({
      skippedSharedImageCount: 1,
      storageCleanupErrorCount: 0
    })

    expect(paintingModel.count).toHaveBeenCalledTimes(1)
    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })
})
