import { IsString, IsOptional, IsInt } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateEventPhotoDto {
  @IsString()
  readonly imgUrl: string

  @IsOptional()
  @IsString()
  readonly title?: string

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly priority?: number
}
