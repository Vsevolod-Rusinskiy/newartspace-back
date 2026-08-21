import { ConflictException, NotFoundException } from '@nestjs/common'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { PaintingsService } from './paintings.service'

const imageUrl =
  'https://storage.yandexcloud.net/newartspace-images-dev/paintings/delete-me.jpg'

interface HarnessOptions {
  found?: boolean
  attributesError?: Error
  paintingError?: Error
  countResult?: number
  countError?: Error
  storageError?: Error
}

const createHarness = (options: HarnessOptions = {}) => {
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
    transaction: jest.fn(async () => transaction)
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
    transaction,
    sequence,
    service
  }
}

describe('PaintingsService.delete', () => {
  it('commits the database deletion before cleaning the unreferenced image', async () => {
    const {
      painting,
      paintingAttributesModel,
      storageService,
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
      'storage'
    ])
    expect(paintingAttributesModel.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ transaction })
    )
    expect(painting.destroy).toHaveBeenCalledWith({ transaction })
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'delete-me.jpg',
      'paintings'
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
      'storage'
    ])
    expect(transaction.rollback).not.toHaveBeenCalled()
  })
})
