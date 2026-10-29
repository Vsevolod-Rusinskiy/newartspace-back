import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../auth/auth.service'
import { UsersService } from './users.service'

export interface UserPaintingsRequest extends Request {
  userPaintingsUserId: number
}

function positiveUserId(value: unknown): number | null {
  const id =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : Number.NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

@Injectable()
export class UserPaintingsOwnerGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UserPaintingsRequest>()
    const authorization = request.headers.authorization
    const token =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1]
        : undefined
    if (!token) throw new UnauthorizedException('Ошибка авторизации')

    const claims = this.authService.verifyToken(token)
    if (claims?.error) throw new UnauthorizedException(claims.error)

    // Refresh tokens contain userId, not the access-token user identity.
    const accessUserId = positiveUserId(claims?.user?.id)
    if (accessUserId === null) {
      throw new UnauthorizedException('Invalid access token identity')
    }
    const user = await this.usersService.findOneById(String(accessUserId))
    if (!user || positiveUserId(user.id) !== accessUserId) {
      throw new UnauthorizedException('Пользователя не существует')
    }

    const routeUserId = positiveUserId(request.params.userId)
    if (routeUserId === null) {
      throw new BadRequestException('User id must be a positive integer')
    }
    if (routeUserId !== accessUserId) {
      throw new ForbiddenException(
        'Доступ к данным другого пользователя запрещен'
      )
    }

    request.userPaintingsUserId = accessUserId
    return true
  }
}
