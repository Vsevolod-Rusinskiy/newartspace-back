import { Injectable, Logger } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { User } from './models/user.model'
import { InjectModel } from '@nestjs/sequelize'
import { LoginUserDto } from '../auth/dto/login-user.dto'
import * as bcrypt from 'bcryptjs'
import { MailService } from '../mail/mail.service'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private mailService: MailService
  ) {}

  async login(loginUserDto: LoginUserDto): Promise<User | null> {
    const user = await this.userModel.findOne({
      where: {
        email: loginUserDto.email
      }
    })

    if (!user) {
      return null
    }

    return user as User
  }

  async registration(createUserDto: CreateUserDto): Promise<User | null> {
    const existingUser = await this.userModel.findOne({
      where: {
        email: createUserDto.email
      }
    })

    if (existingUser) {
      return null
    }

    const hashedPassword = await bcrypt.hash(createUserDto.userPassword, 10)

    const createdUser = new User({
      ...createUserDto,
      userPassword: hashedPassword
    })
    await createdUser.save()

    // Отправляем приветственное письмо
    try {
      await this.mailService.sendMail(
        'Добро пожаловать в Новое пространство!',
        createUserDto.email,
        `Здравствуйте, ${createUserDto.email}!
        
Спасибо за регистрацию. Мы рады приветствовать вас.

С уважением,
Команда Новое пространство`
      )
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`)
      // Не прерываем регистрацию, если письмо не отправилось
    }

    return createdUser
  }

  async findOne(email: string): Promise<User> {
    return this.userModel.findOne({ where: { email } })
  }

  async findOneById(id: string): Promise<User | null> {
    return this.userModel.findOne({ where: { id } })
  }
}
