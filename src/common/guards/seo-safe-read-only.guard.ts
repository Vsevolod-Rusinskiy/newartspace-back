import {
  CanActivate,
  ExecutionContext,
  MethodNotAllowedException
} from '@nestjs/common'

export class SeoSafeReadOnlyGuard implements CanActivate {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.env.SEO_SAFE_MODE !== 'true') return true
    const method = context.switchToHttp().getRequest().method.toUpperCase()
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
    throw new MethodNotAllowedException('SEO_SAFE backend is read-only')
  }
}
