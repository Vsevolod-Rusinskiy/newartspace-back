import { Global, Module } from '@nestjs/common'
import { CacheRevalidationPublisher } from './cache-revalidation.publisher'

@Global()
@Module({
  providers: [CacheRevalidationPublisher],
  exports: [CacheRevalidationPublisher]
})
export class CacheRevalidationModule {}
