import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class UpdateWelcomeDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly content?: string

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean
}
