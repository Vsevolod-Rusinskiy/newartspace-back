import { Injectable } from '@nestjs/common'
import { CreateProfileDto } from './dto/create-profile.dto'

@Injectable()
export class ProfileService {
  create(createProfileDto: CreateProfileDto) {
    console.log(createProfileDto)
    return 'This action adds a new profile'
  }

  async findAll() {
    // ищем покупки пользователя
    return `This action returns all profile`
  }
}
