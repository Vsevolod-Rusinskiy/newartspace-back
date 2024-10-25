import { IsEmail, IsNotEmpty } from 'class-validator'

export class OneClickOrderDto {
  @IsNotEmpty()
  name: string

  @IsNotEmpty()
  phone: string

  @IsEmail()
  email: string
}
