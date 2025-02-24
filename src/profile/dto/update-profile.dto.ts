import { IsString, IsOptional } from 'class-validator'

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  userName?: string

  @IsString()
  @IsOptional()
  newPassword?: string
}
