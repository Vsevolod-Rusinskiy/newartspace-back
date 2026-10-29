import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UsersService } from 'src/users/users.service'
import { User } from 'src/users/models/user.model'
import { JwtService } from '@nestjs/jwt'
import { jwtConstants } from './constants'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(email: string): Promise<User> {
    const user = await this.usersService.findOne(email)
    if (!user) return null
    return user
  }

  async generateAccessToken(user: User) {
    const id = this.positiveUserId(user?.id)
    return { accessToken: this.jwtService.sign({ user: { id } }) }
  }

  async generateRefreshToken(userId: string | number) {
    return {
      refreshToken: this.jwtService.sign(
        { userId: this.positiveUserId(userId) },
        { secret: jwtConstants.secret, expiresIn: '30d' }
      )
    }
  }

  // Kept for existing callers, including the owner guard. Higher-level readers
  // below require the expected identity before accessing the database.
  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token)
    } catch (error) {
      return { error: error.message }
    }
  }

  private verifiedClaims(token: string): Record<string, any> {
    const claims = this.verifyToken(token)
    if (claims?.error) throw new UnauthorizedException(claims.error)
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
      throw new UnauthorizedException('Invalid token identity')
    }
    return claims
  }

  private positiveUserId(value: unknown): number {
    const id =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^[1-9]\d*$/.test(value)
          ? Number(value)
          : Number.NaN
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new UnauthorizedException('Invalid token identity')
    }
    return id
  }

  private async currentUser(userId: number): Promise<User> {
    const user = await this.usersService.findOneById(String(userId))
    if (!user || this.positiveUserId(user.id) !== userId) {
      throw new UnauthorizedException('Пользователя не существует')
    }
    return user
  }

  // The legacy method name remains compatible; identity now comes exclusively
  // from verified access claims and the current database row, never token email.
  async getUserEmailByTokenData(token: string): Promise<User> {
    const claims = this.verifiedClaims(token)
    return this.currentUser(this.positiveUserId(claims.user?.id))
  }

  async getUserByRefreshToken(token: string): Promise<User> {
    const claims = this.verifiedClaims(token)
    return this.currentUser(this.positiveUserId(claims.userId))
  }
}
