import { Injectable, Logger } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { User } from './models/user.model'
import { InjectModel } from '@nestjs/sequelize'
import { LoginUserDto } from '../auth/dto/login-user.dto'
import * as bcrypt from 'bcryptjs'
import { MailService } from '../mail/mail.service'
import { v4 as uuidv4 } from 'uuid'

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
    const verificationToken = uuidv4()

    const createdUser = new User({
      ...createUserDto,
      userPassword: hashedPassword,
      verificationToken,
      isEmailVerified: false
    })
    await createdUser.save()

    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`

    try {
      await this.mailService.sendMail(
        'Подтвердите ваш email',
        createUserDto.email,
        `Здравствуйте, ${createUserDto.email}!
        
Для подтверждения вашего email перейдите по ссылке:
${verificationLink}

Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.

С уважением,
Команда Новое пространство`
      )
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`)
    }

    return createdUser
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await this.userModel.findOne({
      where: { verificationToken: token }
    })

    if (!user) {
      return null
    }

    user.isEmailVerified = true
    user.verificationToken = null
    await user.save()

    return user
  }

  async findOne(email: string): Promise<User> {
    return this.userModel.findOne({ where: { email } })
  }

  async findOneById(id: string): Promise<User | null> {
    return this.userModel.findOne({ where: { id } })
  }
}
