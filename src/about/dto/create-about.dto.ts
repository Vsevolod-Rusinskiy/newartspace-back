import { IsString, IsOptional } from 'class-validator'

export class CreateAboutDto {
  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsString()
  readonly mainText?: string

  @IsOptional()
  @IsString()
  readonly additionalText1?: string

  @IsOptional()
  @IsString()
  readonly additionalText2?: string
}
