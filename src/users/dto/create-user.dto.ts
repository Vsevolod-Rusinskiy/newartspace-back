import { IsString, IsNotEmpty, IsEmail } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  userName: string

  @IsString()
  @IsNotEmpty()
  userPassword: string

  @IsEmail()
  @IsNotEmpty()
  email: string
}
