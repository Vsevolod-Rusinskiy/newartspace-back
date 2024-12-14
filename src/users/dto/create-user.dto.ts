import { IsString, IsNotEmpty } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  userName: string

  @IsString()
  @IsNotEmpty()
  userPassword: string
}
