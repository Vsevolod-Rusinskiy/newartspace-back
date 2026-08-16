import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { createHmac, randomUUID } from 'crypto'
import {
  CACHE_REVALIDATION_ACTIONS,
  CACHE_REVALIDATION_ENTITIES,
  CacheRevalidationEvent,
  CacheRevalidationInput
} from './cache-revalidation.types'

const RETRY_DELAYS_MS = [0, 250, 1000]
const REQUEST_TIMEOUT_MS = 1500
const MINIMUM_SECRET_BYTES = 32

@Injectable()
export class CacheRevalidationPublisher {
  private readonly logger = new Logger(CacheRevalidationPublisher.name)

  constructor(private readonly configService: ConfigService) {}

  schedule(input: CacheRevalidationInput): void {
    try {
      void this.publish(input).catch(() => undefined)
    } catch {
      this.logResult({ result: 'delivery_failed' })
    }
  }

  async publish(input: CacheRevalidationInput): Promise<void> {
    try {
      if (!this.isValidInput(input)) {
        this.logResult({ result: 'invalid_event' })
        return
      }

      if (!this.isEnabled()) {
        this.logResult({ result: 'disabled' })
        return
      }

      const url = this.configService.get<string>('FRONTEND_REVALIDATION_URL')
      const secret = this.configService.get<string>('CACHE_REVALIDATION_SECRET')

      if (!this.isValidConfiguration(url, secret)) {
        this.logResult({ result: 'configuration_error' })
        return
      }

      const event: CacheRevalidationEvent = {
        version: 1,
        eventId: randomUUID(),
        entity: input.entity,
        action: input.action,
        ids: input.ids.map(String)
      }
      const rawBody = JSON.stringify(event)

      for (let index = 0; index < RETRY_DELAYS_MS.length; index += 1) {
        const attempt = index + 1
        const startedAt = Date.now()
        await this.delay(RETRY_DELAYS_MS[index])

        try {
          const timestamp = Math.floor(Date.now() / 1000).toString()
          const signature = createHmac('sha256', secret)
            .update(timestamp + '.' + rawBody)
            .digest('hex')

          await axios.post(url, rawBody, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
              'content-type': 'application/json',
              'x-nas-timestamp': timestamp,
              'x-nas-signature': `sha256=${signature}`
            }
          })
          this.logEvent(event, attempt, 'delivered', Date.now() - startedAt)
          return
        } catch {
          const latency = Date.now() - startedAt
          if (attempt === RETRY_DELAYS_MS.length) {
            this.logEvent(event, attempt, 'delivery_failed', latency, 'error')
            return
          }

          this.logEvent(event, attempt, 'retrying', latency, 'warn')
        }
      }
    } catch {
      this.logResult({ result: 'configuration_error' })
    }
  }

  private isEnabled(): boolean {
    const enabled = this.configService.get<unknown>(
      'CACHE_REVALIDATION_ENABLED'
    )
    return enabled === true || enabled === 'true'
  }

  private isValidConfiguration(url: unknown, secret: unknown): url is string {
    if (
      typeof url !== 'string' ||
      typeof secret !== 'string' ||
      Buffer.byteLength(secret, 'utf8') < MINIMUM_SECRET_BYTES
    ) {
      return false
    }

    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
    } catch {
      return false
    }
  }

  private isValidInput(input: CacheRevalidationInput): boolean {
    return (
      CACHE_REVALIDATION_ENTITIES.includes(input.entity) &&
      CACHE_REVALIDATION_ACTIONS.includes(input.action) &&
      input.ids.length >= 1 &&
      input.ids.length <= 100 &&
      input.ids.every(
        (id) =>
          (typeof id === 'string' && id.trim().length > 0) ||
          (typeof id === 'number' && Number.isFinite(id))
      )
    )
  }

  private delay(milliseconds: number): Promise<void> {
    if (milliseconds === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve) => setTimeout(resolve, milliseconds))
  }

  private logEvent(
    event: CacheRevalidationEvent,
    attempt: number,
    result: 'delivered' | 'retrying' | 'delivery_failed',
    latency: number,
    level: 'log' | 'warn' | 'error' = 'log'
  ): void {
    this.logger[level](
      JSON.stringify({
        eventId: event.eventId,
        entity: event.entity,
        action: event.action,
        idsCount: event.ids.length,
        attempt,
        result,
        latency
      })
    )
  }

  private logResult(result: { result: string }): void {
    this.logger.log(JSON.stringify(result))
  }
}
