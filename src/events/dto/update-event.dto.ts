import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'

export class UpdateEventDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly title?: string

  @IsOptional()
  @IsString()
  readonly content?: string

  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly priority?: number

  @IsOptional()
  @IsDateString()
  readonly date?: string

  @IsOptional()
  readonly pictures?: Image | null

  @IsOptional()
  readonly eventPhotoIds?: number[]

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string
}
