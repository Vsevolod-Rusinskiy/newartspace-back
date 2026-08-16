const createTransport = jest.fn()
jest.mock('nodemailer', () => ({ createTransport }))
import { ServiceUnavailableException } from '@nestjs/common'
import { MailService } from './mail.service'

describe('MailService SEO_SAFE isolation', () => {
  const originalEnv = process.env
  afterEach(() => {
    process.env = originalEnv
    jest.clearAllMocks()
  })
  it('does not construct or invoke a network-capable transporter in SEO_SAFE', async () => {
    process.env = { ...originalEnv, SEO_SAFE_MODE: 'true' }
    const service = new MailService()
    await expect(
      service.sendMail('subject', 'to@example.test', 'body')
    ).rejects.toThrow(ServiceUnavailableException)
    expect(createTransport).not.toHaveBeenCalled()
  })
})
