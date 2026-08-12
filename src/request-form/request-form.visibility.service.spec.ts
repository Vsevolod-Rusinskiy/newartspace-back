import { BadRequestException } from '@nestjs/common'
import { RequestFormService } from './request-form.service'

const orderData = {
  name: 'Test',
  phone: '+70000000000',
  email: 'test@example.com',
  deliveryMethod: 'pickup'
}

describe('RequestFormService painting visibility', () => {
  const createService = (paintingModel: object) => {
    const mailService = { sendMail: jest.fn() }
    const service = new RequestFormService(
      paintingModel as never,
      mailService as never,
      {} as never,
      {} as never,
      {} as never
    )
    return { service, mailService }
  }

  it('rejects a hidden or missing reproduction before sending mail', async () => {
    const { service, mailService } = createService({
      findOne: jest.fn().mockResolvedValue(null)
    })

    await expect(
      service.sendOrderReproduction({ ...orderData, paintingId: 11 })
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(mailService.sendMail).not.toHaveBeenCalled()
  })

  it('rejects a cart when any requested painting is hidden or missing', async () => {
    const { service, mailService } = createService({
      findAll: jest.fn().mockResolvedValue([{ id: 10 }])
    })

    await expect(
      service.sendOrderCart({ ...orderData, cartItemIds: [10, 11] })
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(mailService.sendMail).not.toHaveBeenCalled()
  })
})
