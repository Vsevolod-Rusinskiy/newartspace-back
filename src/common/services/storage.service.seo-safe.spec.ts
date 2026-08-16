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
  })
})
