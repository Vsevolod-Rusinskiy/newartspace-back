import { BadRequestException } from '@nestjs/common'

export interface ManagedPaintingImageReference {
  canonicalUrl: string
  objectKey: string
  fileName: string
}

const STORAGE_HOST = 'storage.yandexcloud.net'
const CATEGORY = 'paintings'
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function isSafeManagedPaintingImageFileName(fileName: string): boolean {
  return (
    typeof fileName === 'string' &&
    SAFE_FILE_NAME.test(fileName) &&
    !fileName.includes('%')
  )
}

const invalidReference = (): never => {
  throw new BadRequestException('Painting image must be a managed storage URL')
}

const validateFileName = (fileName: string): string => {
  if (!isSafeManagedPaintingImageFileName(fileName)) {
    return invalidReference()
  }
  return fileName
}

export function resolveManagedPaintingImageFileName(
  fileName: string,
  bucketName: string
): ManagedPaintingImageReference {
  if (typeof bucketName !== 'string' || bucketName.length === 0) {
    return invalidReference()
  }
  const safeFileName = validateFileName(fileName)
  return {
    canonicalUrl: `https://${STORAGE_HOST}/${bucketName}/${CATEGORY}/${safeFileName}`,
    objectKey: `${CATEGORY}/${safeFileName}`,
    fileName: safeFileName
  }
}

export function resolveManagedPaintingImageUrl(
  imgUrl: string,
  bucketName: string
): ManagedPaintingImageReference {
  if (typeof imgUrl !== 'string' || typeof bucketName !== 'string') {
    return invalidReference()
  }

  let parsed: URL
  try {
    parsed = new URL(imgUrl)
  } catch {
    return invalidReference()
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== STORAGE_HOST ||
    parsed.port !== '' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.pathname.includes('%')
  ) {
    return invalidReference()
  }

  const parts = parsed.pathname.split('/')
  if (parts.length !== 4 || parts[0] !== '' || parts[1] !== bucketName) {
    return invalidReference()
  }

  const reference = resolveManagedPaintingImageFileName(parts[3], bucketName)
  if (parts[2] !== CATEGORY || imgUrl !== reference.canonicalUrl) {
    return invalidReference()
  }
  return reference
}
