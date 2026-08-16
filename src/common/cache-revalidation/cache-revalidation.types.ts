export const CACHE_REVALIDATION_ENTITIES = [
  'painting',
  'artist',
  'event',
  'event-photo',
  'about',
  'working-hours'
] as const

export const CACHE_REVALIDATION_ACTIONS = [
  'created',
  'updated',
  'deleted'
] as const

export type CacheRevalidationEntity =
  (typeof CACHE_REVALIDATION_ENTITIES)[number]

export type CacheRevalidationAction =
  (typeof CACHE_REVALIDATION_ACTIONS)[number]

export interface CacheRevalidationInput {
  entity: CacheRevalidationEntity
  action: CacheRevalidationAction
  ids: Array<string | number>
}

export interface CacheRevalidationEvent {
  version: 1
  eventId: string
  entity: CacheRevalidationEntity
  action: CacheRevalidationAction
  ids: string[]
}
