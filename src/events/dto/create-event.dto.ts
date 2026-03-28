import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'

export class CreateEventDto {
  @IsOptional()
  @IsString()
  readonly title?: string

  @IsOptional()
  @IsString()
  readonly content?: string

  @IsOptional()
  readonly pictures?: Image

  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsDateString()
  readonly date?: string

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly priority?: number

  @IsOptional()
  readonly eventPhotoIds?: number[]

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string
}
