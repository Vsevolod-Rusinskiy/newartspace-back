import { Injectable } from '@nestjs/common'
import { UsersService } from 'src/users/users.service'
import { User } from 'src/users/models/user.model'

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async validateUser(userName: string): Promise<User> {
    const user = await this.usersService.findOne(userName)
    if (!user) {
      return null
    }
    return user
  }
}
