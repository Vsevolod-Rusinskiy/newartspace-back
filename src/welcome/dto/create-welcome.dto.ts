import { IsString, IsBoolean, IsOptional } from 'class-validator'

export class CreateWelcomeDto {
  @IsString()
  readonly content: string

  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean
}
