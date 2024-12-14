import { IsString, IsNotEmpty } from 'class-validator'

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  userName: string

  @IsString()
  @IsNotEmpty()
  userPassword: string
}
