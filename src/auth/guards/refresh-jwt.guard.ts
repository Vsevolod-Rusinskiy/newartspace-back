import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { UsersService } from 'src/users/users.service'
import { AuthService } from 'src/auth/auth.service'

@Injectable()
export class RefreshJWTGuard implements CanActivate {
  constructor(
    private usersService: UsersService,
    private authService: AuthService
  ) {}

  async canActivate(
    context: ExecutionContext
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()

    const { refreshToken } = request.body

    if (!refreshToken) {
      console.log('Ошибка: refreshToken отсутствует')
      throw new UnauthorizedException('Поле refreshToken обязательно')
    }

    const userId = this.authService.parseJwt(refreshToken).userId.toString()
    console.log('Извлеченный userId:', userId)

    const user = await this.usersService.findOneById(userId)
    console.log('Найденный пользователь:', user)

    if (!user) {
      console.log('Ошибка: Пользователь не существует')
      throw new UnauthorizedException('Пользователя не существует')
    }

    return true
  }
}
