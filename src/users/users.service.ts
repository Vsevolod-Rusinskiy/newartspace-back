import { Injectable, Logger } from '@nestjs/common'
import { CreateUserDto } from './dto/create-user.dto'
import { User } from './models/user.model'
import { InjectModel } from '@nestjs/sequelize'
import { LoginUserDto } from '../auth/dto/login-user.dto'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(User)
    private userModel: typeof User
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

    const createdUser = new User({
      ...createUserDto
    })
    await createdUser.save()
    return createdUser
  }

  async findOne(email: string): Promise<User> {
    return this.userModel.findOne({ where: { email } })
  }
}
