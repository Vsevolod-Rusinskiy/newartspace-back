import { Injectable, Logger } from '@nestjs/common'
import { UsersService } from 'src/users/users.service'
import { User } from 'src/users/models/user.model'
import { JwtService } from '@nestjs/jwt'
import { jwtConstants } from './constants'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(email: string): Promise<User> {
    const user = await this.usersService.findOne(email)
    if (!user) {
      return null
    }
    return user
  }

  async generateAccessToken(user: User) {
    return {
      accessToken: this.jwtService.sign({ user })
    }
  }

  async generateRefreshToken(userId: string) {
    return {
      refreshToken: this.jwtService.sign(
        { userId },
        {
          secret: jwtConstants.secret,
          expiresIn: '30d'
        }
      )
    }
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token)
    } catch (error) {
      return { error: error.message }
    }
  }

  parseJwt(token: string) {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )

    return JSON.parse(jsonPayload)
  }

  async getUserEmailByTokenData(token: string): Promise<User> {
    const parsedTokenData = this.parseJwt(token)
    const user = await this.usersService.findOne(parsedTokenData.user.email)
    return user
  }
}
