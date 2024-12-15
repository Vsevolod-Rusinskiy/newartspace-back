import { IsString, IsNotEmpty } from 'class-validator'

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string

  @IsString()
  @IsNotEmpty()
  userName: string
}
