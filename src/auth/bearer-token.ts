import { UnauthorizedException } from '@nestjs/common'

export function bearerToken(authorization: unknown): string {
  const token =
    typeof authorization === 'string'
      ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1]
      : undefined
  if (!token) throw new UnauthorizedException('Ошибка авторизации')
  return token
}
