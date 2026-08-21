import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/sequelize'
import { PaintingsService } from './paintings.service'
import { Painting } from './models/painting.model'
import { PaintingAttributes } from './models/painting-attributes.model'
import { StorageService } from '../common/services/storage.service'
import { Sequelize } from 'sequelize-typescript'
import { BadRequestException } from '@nestjs/common'

describe('PaintingsService.update — storage delete guard', () => {
  let service: PaintingsService
  let storageService: { deleteFile: jest.Mock; fileExists: jest.Mock }
  let paintingModel: { update: jest.Mock; findOne: jest.Mock; count: jest.Mock }
  let sequelize: { transaction: jest.Mock; query: jest.Mock }
  let transaction: { LOCK: { UPDATE: string } }

  const oldImgUrl =
    'https://storage.yandexcloud.net/newartspace-images/paintings/old-file.jpg'

  const existingPainting = {
    id: 235,
    imgUrl: oldImgUrl,
    artist: { artistName: 'Кабанченко Светлана' },
    toJSON() {
      return {
        id: this.id,
        imgUrl: this.imgUrl,
        artist: this.artist
      }
    }
  }

  beforeEach(async () => {
    storageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      fileExists: jest.fn().mockResolvedValue(true)
    }
    transaction = { LOCK: { UPDATE: 'UPDATE' } }
    sequelize = {
      transaction: jest.fn(async (callback) => callback(transaction)),
      query: jest.fn().mockResolvedValue(undefined)
    }
    paintingModel = {
      update: jest.fn().mockResolvedValue([1]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaintingsService,
        { provide: getModelToken(Painting), useValue: paintingModel },
        {
          provide: getModelToken(PaintingAttributes),
          useValue: {
            destroy: jest.fn(),
            create: jest.fn()
          }
        },
        { provide: StorageService, useValue: storageService },
        { provide: Sequelize, useValue: sequelize }
      ]
    }).compile()

    service = module.get(PaintingsService)
  })

  it('does not delete Object Storage file when PATCH has no imgUrl', async () => {
    paintingModel.findOne
      .mockResolvedValueOnce(existingPainting)
      .mockResolvedValueOnce(existingPainting)

    await service.update(235, { title: 'Без названия' })

    expect(storageService.deleteFile).not.toHaveBeenCalled()
    expect(paintingModel.update).toHaveBeenCalled()
  })

  it('deletes previous file when a new imgUrl is provided', async () => {
    const newImgUrl =
      'https://storage.yandexcloud.net/newartspace-images/paintings/new-file.jpg'

    paintingModel.findOne
      .mockResolvedValueOnce(existingPainting)
      .mockResolvedValueOnce({
        ...existingPainting,
        imgUrl: newImgUrl,
        toJSON() {
          return { id: 235, imgUrl: newImgUrl, artist: existingPainting.artist }
        }
      })

    await service.update(235, {
      title: 'Без названия',
      imgUrl: newImgUrl
    })

    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'old-file.jpg',
      'paintings'
    )
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({
        replacements: { imgUrl: newImgUrl },
        transaction
      })
    )
    expect(storageService.fileExists).toHaveBeenCalledWith(
      'new-file.jpg',
      'paintings'
    )
    expect(paintingModel.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ transaction })
    )
  })

  it('does not delete file when imgUrl is unchanged', async () => {
    paintingModel.findOne
      .mockResolvedValueOnce(existingPainting)
      .mockResolvedValueOnce(existingPainting)

    await service.update(235, {
      title: 'Без названия',
      imgUrl: oldImgUrl
    })

    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })

  it('keeps the existing row and image when the replacement object is missing', async () => {
    const missingImgUrl =
      'https://storage.yandexcloud.net/newartspace-images/paintings/missing.jpg'
    storageService.fileExists.mockResolvedValue(false)
    paintingModel.findOne.mockResolvedValueOnce(existingPainting)

    await expect(
      service.update(235, { title: 'Без названия', imgUrl: missingImgUrl })
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(paintingModel.update).not.toHaveBeenCalled()
    expect(storageService.deleteFile).not.toHaveBeenCalled()
  })
})
