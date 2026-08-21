const credentials = jest.fn()
const s3 = jest.fn()

jest.mock('aws-sdk', () => ({
  Credentials: credentials,
  S3: s3
}))

import { ServiceUnavailableException } from '@nestjs/common'
import { StorageService } from './storage.service'

describe('StorageService SEO_SAFE isolation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, BUCKET_NAME: 'bucket' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('does not construct an S3 client or call network methods in SEO_SAFE', async () => {
    process.env.SEO_SAFE_MODE = 'true'
    const service = new StorageService()

    await expect(
      service.uploadFile(Buffer.from('file'), 'file.png', 'paintings')
    ).rejects.toThrow(ServiceUnavailableException)
    await expect(service.deleteFile('file.png', 'paintings')).rejects.toThrow(
      ServiceUnavailableException
    )
    await expect(service.fileExists('file.png', 'paintings')).rejects.toThrow(
      ServiceUnavailableException
    )
    expect(credentials).not.toHaveBeenCalled()
    expect(s3).not.toHaveBeenCalled()
  })

  it('constructs the ordinary S3 client outside SEO_SAFE', () => {
    delete process.env.SEO_SAFE_MODE
    credentials.mockImplementation(() => ({}))
    s3.mockImplementation(() => ({}))

    new StorageService()

    expect(credentials).toHaveBeenCalledTimes(1)
    expect(s3).toHaveBeenCalledTimes(1)
    expect(s3).toHaveBeenCalledWith(
      expect.objectContaining({
        httpOptions: { connectTimeout: 2000, timeout: 5000 },
        maxRetries: 1
      })
    )
  })

  it('checks an exact managed object without changing storage', async () => {
    delete process.env.SEO_SAFE_MODE
    const promise = jest.fn().mockResolvedValue({})
    const headObject = jest.fn(() => ({ promise }))
    credentials.mockImplementation(() => ({}))
    s3.mockImplementation(() => ({ headObject }))
    const service = new StorageService()

    await expect(service.fileExists('file.png', 'paintings')).resolves.toBe(
      true
    )

    expect(headObject).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'paintings/file.png'
    })
  })

  it('returns false only for an exact missing managed object', async () => {
    delete process.env.SEO_SAFE_MODE
    const promise = jest.fn().mockRejectedValue({ code: 'NotFound' })
    credentials.mockImplementation(() => ({}))
    s3.mockImplementation(() => ({
      headObject: jest.fn(() => ({ promise }))
    }))
    const service = new StorageService()

    await expect(service.fileExists('missing.png', 'paintings')).resolves.toBe(
      false
    )
  })
})
