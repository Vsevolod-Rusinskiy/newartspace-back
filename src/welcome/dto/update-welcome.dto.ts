import { IsString, IsOptional } from 'class-validator'

export class UpdateWelcomeDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly content?: string
}
