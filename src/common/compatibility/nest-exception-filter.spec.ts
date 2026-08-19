import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

describe('NestJS exception handling compatibility', () => {
  it('converts an unknown error into a 500 response without throwing', () => {
    const response = {}
    const reply = jest.fn()
    const httpAdapter = {
      isHeadersSent: () => false,
      reply,
      end: jest.fn()
    }
    const host = {
      getArgByIndex: (index: number) => (index === 1 ? response : undefined)
    } as ArgumentsHost
    const filter = new BaseExceptionFilter(httpAdapter as any)
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)

    try {
      expect(() =>
        filter.catch(new Error('invalid database input'), host)
      ).not.toThrow()
    } finally {
      loggerError.mockRestore()
    }
    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    )
  })
})
