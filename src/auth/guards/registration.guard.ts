import { CanActivate, UnauthorizedException } from '@nestjs/common'

import { Injectable } from '@nestjs/common'
import { AuthService } from '../auth.service'
import { ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class RegistrationGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(
    context: ExecutionContext

    // eslint disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error: игнорируем ошибку, так как тип не может быть определен
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const username = request.body.userName
    const user = await this.authService.validateUser(username)

    if (user) {
      throw new UnauthorizedException(`Пользователь ${username} уже существует`)
    }

    return true
  }
}
