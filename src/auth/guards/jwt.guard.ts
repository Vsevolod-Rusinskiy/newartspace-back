import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'
import { User } from '../../users/models/user.model'
import { AuthService } from '../auth.service'
import { bearerToken } from '../bearer-token'

export interface AuthenticatedRequest extends Request {
  token: string
  authUser: User
}

@Injectable()
export class JWTGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = bearerToken(request.headers.authorization)
    request.authUser = await this.authService.getUserEmailByTokenData(token)
    request.token = token
    return true
  }
}
