import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { UsersService } from 'src/users/users.service'

@Injectable()
export class RefreshJWTGuard implements CanActivate {
  constructor(private usersService: UsersService) {}
  async canActivate(
    context: ExecutionContext
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()

    const { refreshToken, userName } = request.body

    if (!refreshToken) {
      throw new UnauthorizedException('Поле refreshToken обязательно')
    }

    if (!userName) {
      throw new UnauthorizedException('Поле userName обязательно')
    }

    const user = await this.usersService.findOne(userName)

    if (!user) {
      throw new UnauthorizedException('Пользователя не существует')
    }

    return true
  }
}
