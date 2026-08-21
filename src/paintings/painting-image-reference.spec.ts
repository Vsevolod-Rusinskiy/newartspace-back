import { BadRequestException } from '@nestjs/common'
import {
  resolveManagedPaintingImageFileName,
  resolveManagedPaintingImageUrl
} from './painting-image-reference'

describe('managed painting image identity', () => {
  const bucketName = 'newartspace-images-dev'
  const canonicalUrl =
    'https://storage.yandexcloud.net/newartspace-images-dev/paintings/image-1.jpg'

  it('derives one canonical URL and object key', () => {
    expect(resolveManagedPaintingImageUrl(canonicalUrl, bucketName)).toEqual({
      canonicalUrl,
      objectKey: 'paintings/image-1.jpg',
      fileName: 'image-1.jpg'
    })
  })

  it.each([
    [
      'wrong host',
      'https://example.test/newartspace-images-dev/paintings/image-1.jpg'
    ],
    [
      'wrong bucket',
      'https://storage.yandexcloud.net/newartspace-images/paintings/image-1.jpg'
    ],
    [
      'wrong category',
      'https://storage.yandexcloud.net/newartspace-images-dev/events/image-1.jpg'
    ],
    ['query', `${canonicalUrl}?token=secret`],
    ['hash', `${canonicalUrl}#fragment`],
    [
      'credentials',
      'https://user:pass@storage.yandexcloud.net/newartspace-images-dev/paintings/image-1.jpg'
    ],
    ['extra path', `${canonicalUrl}/extra`],
    [
      'encoded slash',
      'https://storage.yandexcloud.net/newartspace-images-dev/paintings/image%2F1.jpg'
    ]
  ])('rejects %s instead of aliasing a managed key', (_label, imgUrl) => {
    expect(() => resolveManagedPaintingImageUrl(imgUrl, bucketName)).toThrow(
      BadRequestException
    )
  })

  it('builds the same identity for unused-upload cleanup', () => {
    expect(
      resolveManagedPaintingImageFileName('image-1.jpg', bucketName)
    ).toEqual({
      canonicalUrl,
      objectKey: 'paintings/image-1.jpg',
      fileName: 'image-1.jpg'
    })
  })

  it.each(['', '../image.jpg', 'folder/image.jpg', 'image.jpg?x=1'])(
    'rejects unsafe cleanup file name %s',
    (fileName) => {
      expect(() =>
        resolveManagedPaintingImageFileName(fileName, bucketName)
      ).toThrow(BadRequestException)
    }
  )
})
