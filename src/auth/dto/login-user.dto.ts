import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator'

export class LoginUserDto {
  @IsString()
  @IsOptional()
  userName?: string

  @IsString()
  @IsNotEmpty()
  userPassword: string

  @IsEmail()
  @IsNotEmpty()
  email: string
}
