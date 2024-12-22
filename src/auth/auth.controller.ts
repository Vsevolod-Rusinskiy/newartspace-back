import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Logger,
  Get,
  Query
} from '@nestjs/common'
import { CreateUserDto } from 'src/users/dto/create-user.dto'
import { UsersService } from 'src/users/users.service'
import { Response } from 'express'
import { RegistrationGuard } from './guards/registration.guard'
import { LoginUserDto } from './dto/login-user.dto'
import { LoginGuard } from './guards/login.guard'
import { AuthService } from './auth.service'
import { RefreshJWTGuard } from './guards/refresh-jwt.guard'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  @UseGuards(LoginGuard)
  @Post('login')
  async loginUser(@Body() loginUserDto: LoginUserDto, @Res() res: Response) {
    const user = await this.usersService.login(loginUserDto)

    const access = await this.authService.generateAccessToken(user)
    const refresh = await this.authService.generateRefreshToken(user.id)

    res.statusCode = HttpStatus.OK
    return res.send({ ...access, ...refresh, userName: user.userName })
  }

  @UseGuards(RegistrationGuard)
  @Post('registration')
  async registrationUser(
    @Body() createUserDto: CreateUserDto,
    @Res() res: Response
  ) {
    const user = await this.usersService.registration(createUserDto)

    res.statusCode = HttpStatus.OK
    return res.send({
      message: 'User registered successfully',
      userName: user.userName
    })
  }

  @UseGuards(RefreshJWTGuard)
  @Post('refresh')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res() res: Response
  ) {
    const validToken = this.authService.verifyToken(
      refreshTokenDto.refreshToken
    )

    if (validToken?.error) {
      throw new UnauthorizedException(validToken.error)
    }

    const userId = this.authService
      .parseJwt(refreshTokenDto.refreshToken)
      .userId.toString()

    const user = await this.usersService.findOneById(userId)
    const access = await this.authService.generateAccessToken(user)

    if (validToken?.error) {
      if (validToken?.error === 'jwt expired') {
        const refresh = await this.authService.generateRefreshToken(
          user.id as string
        )

        res.statusCode = HttpStatus.OK
        return res.send({ ...access, ...refresh, userName: user.userName })
      } else {
        res.statusCode = HttpStatus.BAD_REQUEST
        return res.send({ error: validToken?.error })
      }
    } else {
      res.statusCode = HttpStatus.OK
      return res.send({
        ...access,
        refreshToken: refreshTokenDto.refreshToken,
        userName: user.userName
      })
    }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    const user = await this.usersService.verifyEmail(token)
    if (!user) {
      throw new UnauthorizedException('Invalid verification token')
    }
    return { message: 'Email verified successfully' }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.createPasswordResetToken(
      forgotPasswordDto.email
    )

    if (!user) {
      throw new UnauthorizedException(`User with this email not found`)
    }

    return { message: 'Password reset instructions sent to your email' }
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const user = await this.usersService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    )

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token')
    }

    return { message: 'Password successfully changed' }
  }
}
