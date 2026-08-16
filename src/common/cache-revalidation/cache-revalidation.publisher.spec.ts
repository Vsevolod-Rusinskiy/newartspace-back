import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'
import axios from 'axios'
import { createHmac } from 'crypto'
import { CacheRevalidationPublisher } from './cache-revalidation.publisher'

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}))

describe('CacheRevalidationPublisher', () => {
  const secret = '0123456789abcdef0123456789abcdef'
  const url = 'http://frontend.test/api/internal/cache-revalidate'
  const nowMilliseconds = Date.parse('2026-08-16T12:00:00.000Z')
  const axiosPost = axios.post as jest.Mock
  let config: { get: jest.Mock }
  let publisher: CacheRevalidationPublisher

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(nowMilliseconds))
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    axiosPost.mockReset()
    config = {
      get: jest.fn(
        (key: string) =>
          ({
            CACHE_REVALIDATION_ENABLED: true,
            FRONTEND_REVALIDATION_URL: url,
            CACHE_REVALIDATION_SECRET: secret
          })[key]
      )
    }
    publisher = new CacheRevalidationPublisher(
      config as unknown as ConfigService
    )
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('does not request when publishing is disabled or misconfigured', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          CACHE_REVALIDATION_ENABLED: false,
          FRONTEND_REVALIDATION_URL: url,
          CACHE_REVALIDATION_SECRET: secret
        })[key]
    )

    await expect(
      publisher.publish({ entity: 'painting', action: 'updated', ids: ['12'] })
    ).resolves.toBeUndefined()

    config.get.mockImplementation(
      (key: string) =>
        ({
          CACHE_REVALIDATION_ENABLED: true,
          FRONTEND_REVALIDATION_URL: url,
          CACHE_REVALIDATION_SECRET: 'too-short'
        })[key]
    )

    await expect(
      publisher.publish({ entity: 'painting', action: 'updated', ids: ['12'] })
    ).resolves.toBeUndefined()
    expect(axiosPost).not.toHaveBeenCalled()
  })

  it('does not request for empty or invalid ids and still resolves', async () => {
    await expect(
      publisher.publish({ entity: 'event', action: 'updated', ids: [] })
    ).resolves.toBeUndefined()
    await expect(
      publisher.publish({ entity: 'event', action: 'updated', ids: [''] })
    ).resolves.toBeUndefined()
    await expect(
      publisher.publish({
        entity: 'event',
        action: 'updated',
        ids: [Number.NaN]
      })
    ).resolves.toBeUndefined()

    expect(axiosPost).not.toHaveBeenCalled()
  })

  it('never throws from schedule when publication unexpectedly throws', () => {
    jest.spyOn(publisher, 'publish').mockImplementation(() => {
      throw new Error('unexpected publisher failure')
    })

    expect(() =>
      publisher.schedule({ entity: 'painting', action: 'updated', ids: ['12'] })
    ).not.toThrow()
  })

  it('sends an exact raw JSON body with normalized ids and matching HMAC', async () => {
    axiosPost.mockResolvedValue({ status: 200 })

    await publisher.publish({
      entity: 'painting',
      action: 'updated',
      ids: [12, 'artist-7']
    })

    expect(axiosPost).toHaveBeenCalledTimes(1)
    const [calledUrl, rawBody, options] = axiosPost.mock.calls[0]
    const event = JSON.parse(rawBody)
    const timestamp = '1786881600'
    const signature = createHmac('sha256', secret)
      .update(timestamp + '.' + rawBody)
      .digest('hex')

    expect(calledUrl).toBe(url)
    expect(rawBody).toBe(JSON.stringify(event))
    expect(event).toEqual({
      version: 1,
      eventId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
      entity: 'painting',
      action: 'updated',
      ids: ['12', 'artist-7']
    })
    expect(options).toEqual({
      timeout: 1500,
      headers: {
        'content-type': 'application/json',
        'x-nas-timestamp': timestamp,
        'x-nas-signature': `sha256=${signature}`
      }
    })
  })

  it('retries a temporary failure at 0ms, +250ms, and +1250ms before resolving', async () => {
    const attemptTimes: number[] = []
    axiosPost.mockImplementation(() => {
      attemptTimes.push(Date.now())
      return Promise.reject(new Error('network failed'))
    })

    const completion = publisher.publish({
      entity: 'artist',
      action: 'updated',
      ids: ['7']
    })

    await jest.advanceTimersByTimeAsync(0)
    expect(attemptTimes).toEqual([nowMilliseconds])

    await jest.advanceTimersByTimeAsync(249)
    expect(attemptTimes).toEqual([nowMilliseconds])

    await jest.advanceTimersByTimeAsync(1)
    expect(attemptTimes).toEqual([nowMilliseconds, nowMilliseconds + 250])

    await jest.advanceTimersByTimeAsync(999)
    expect(attemptTimes).toEqual([nowMilliseconds, nowMilliseconds + 250])

    await jest.advanceTimersByTimeAsync(1)

    await expect(completion).resolves.toBeUndefined()
    expect(axiosPost).toHaveBeenCalledTimes(3)
    expect(attemptTimes).toEqual([
      nowMilliseconds,
      nowMilliseconds + 250,
      nowMilliseconds + 1250
    ])
  })

  it('stops retrying after a successful delivery', async () => {
    axiosPost.mockRejectedValueOnce(new Error('temporary'))
    axiosPost.mockResolvedValueOnce({ status: 200 })

    const completion = publisher.publish({
      entity: 'working-hours',
      action: 'updated',
      ids: ['1']
    })
    await jest.runAllTimersAsync()

    await expect(completion).resolves.toBeUndefined()
    expect(axiosPost).toHaveBeenCalledTimes(2)
  })

  it('logs delivery failures without the secret, signature, or raw body', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    axiosPost.mockRejectedValue(new Error('network failed'))

    const completion = publisher.publish({
      entity: 'about',
      action: 'updated',
      ids: ['about-1']
    })
    await jest.runAllTimersAsync()
    await completion

    const logs = errorSpy.mock.calls.flat().join(' ')
    expect(logs).toContain('delivery_failed')
    expect(logs).not.toContain(secret)
    expect(logs).not.toContain('sha256=')
    expect(logs).not.toContain('"version":1')
  })
})
