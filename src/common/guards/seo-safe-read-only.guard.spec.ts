import { MethodNotAllowedException } from '@nestjs/common'
import { SeoSafeReadOnlyGuard } from './seo-safe-read-only.guard'

const contextFor = (method: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method }) })
  }) as any

describe('SeoSafeReadOnlyGuard', () => {
  it('preserves ordinary mode and permits read methods in SEO_SAFE', () => {
    expect(new SeoSafeReadOnlyGuard({}).canActivate(contextFor('POST'))).toBe(
      true
    )
    for (const method of ['get', 'HEAD', 'Options']) {
      expect(
        new SeoSafeReadOnlyGuard({ SEO_SAFE_MODE: 'true' }).canActivate(
          contextFor(method)
        )
      ).toBe(true)
    }
  })

  it('blocks every mutating HTTP method before a controller can run', () => {
    const guard = new SeoSafeReadOnlyGuard({ SEO_SAFE_MODE: 'true' })
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => guard.canActivate(contextFor(method))).toThrow(
        MethodNotAllowedException
      )
    }
  })
})
