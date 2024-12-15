import { Injectable } from '@nestjs/common'
import { CreateAccountDto } from './dto/create-account.dto'
// import { UpdateAccountDto } from './dto/update-account.dto'

@Injectable()
export class AccountService {
  create(createAccountDto: CreateAccountDto) {
    console.log(createAccountDto)
    return 'This action adds a new account'
  }

  async findAll() {
    // ищем покупки пользователя
    return `This action returns all account`
  }

  // findOne(id: number) {
  //   return `This action returns a #${id} account`
  // }

  // update(id: number, updateAccountDto: UpdateAccountDto) {
  //   console.log(updateAccountDto)
  //   return `This action updates a #${id} account`
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} account`
  // }
}
