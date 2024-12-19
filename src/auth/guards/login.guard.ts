import { CanActivate, UnauthorizedException } from '@nestjs/common'

import { Injectable } from '@nestjs/common'
import { AuthService } from '../auth.service'
import { ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(
    context: ExecutionContext

    // eslint disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error: игнорируем ошибку, так как тип не может быть определен
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const { email, userPassword } = request.body
    const user = await this.authService.validateUser(email)

    console.log(user)
    if (!user) {
      throw new UnauthorizedException(`Пользователя ${email} не существует`)
    }

    const isPasswordValid = await bcrypt.compare(
      userPassword,
      user.userPassword
    )
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный пароль')
    }

    return true
  }
}
