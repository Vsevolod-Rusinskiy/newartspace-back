import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  UseGuards
} from '@nestjs/common'
import { CreateUserDto } from 'src/users/dto/create-user.dto'
import { UsersService } from 'src/users/users.service'
import { Response } from 'express'
import { RegistrationGuard } from './guards/registration.guard'
import { LoginUserDto } from './dto/login-user.dto'
import { LoginGuard } from './guards/login.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(LoginGuard)
  @Post('login')
  async loginUser(@Body() loginUserDto: LoginUserDto, @Res() res: Response) {
    const user = await this.usersService.login(loginUserDto)

    res.statusCode = HttpStatus.OK
    return res.send({ username: user.userName })
  }

  @UseGuards(RegistrationGuard)
  @Post('registration')
  async registrationUser(
    @Body() createUserDto: CreateUserDto,
    @Res() res: Response
  ) {
    await this.usersService.registration(createUserDto)

    res.statusCode = HttpStatus.OK
    return res.send({ message: 'User registered successfully' })
  }
}
