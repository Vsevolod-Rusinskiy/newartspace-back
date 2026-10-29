import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { Request } from 'express'
import { User } from '../../users/models/user.model'
import { AuthService } from '../auth.service'

export interface RefreshRequest extends Request {
  refreshUser: User
}

@Injectable()
export class RefreshJWTGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RefreshRequest>()
    const token = request.body?.refreshToken
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Поле refreshToken обязательно')
    }
    request.refreshUser = await this.authService.getUserByRefreshToken(token)
    return true
  }
}
