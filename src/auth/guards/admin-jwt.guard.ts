import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { AuthService } from '../auth.service'

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const token = request.headers.authorization?.split(' ')[1]

    if (!token) {
      throw new UnauthorizedException('Ошибка авторизации')
    }

    const validToken = this.authService.verifyToken(token)

    if (validToken?.error) {
      throw new UnauthorizedException(validToken.error)
    }

    const user = await this.authService.getUserEmailByTokenData(token)

    if (!user?.isAdmin) {
      throw new UnauthorizedException(
        'Доступ запрещен. Требуются права администратора'
      )
    }

    return (request.token = token)
  }
}
