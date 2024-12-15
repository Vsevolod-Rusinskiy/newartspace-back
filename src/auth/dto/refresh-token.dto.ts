import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator'

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string

  @IsString()
  @IsOptional()
  userName?: string

  @IsEmail()
  @IsNotEmpty()
  email: string
}
