import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber
} from 'class-validator'

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

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  favorites?: number[]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  cart?: number[]
}
