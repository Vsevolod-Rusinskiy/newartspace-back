import { IsString } from 'class-validator'

export class CreateWelcomeDto {
  @IsString()
  readonly content: string
}
