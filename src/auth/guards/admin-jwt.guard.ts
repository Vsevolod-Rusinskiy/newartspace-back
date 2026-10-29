import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { AuthService } from '../auth.service'
import { bearerToken } from '../bearer-token'

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = bearerToken(request.headers.authorization)
    const user = await this.authService.getUserEmailByTokenData(token)
    if (!user.isAdmin) {
      throw new UnauthorizedException(
        'Доступ запрещен. Требуются права администратора'
      )
    }
    request.token = token
    return true
  }
}
