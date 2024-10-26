import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class OneClickOrderDto {
  @IsNotEmpty()
  name: string

  @IsNotEmpty()
  phone: string

  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  captcha?: string
}
