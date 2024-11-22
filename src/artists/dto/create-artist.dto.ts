import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'
import { Painting } from 'src/paintings/models/painting.model'

export class CreateArtistDto {
  @IsOptional()
  @IsString()
  readonly artistName?: string

  @IsOptional()
  @IsString()
  readonly artistDescription?: string

  @IsOptional()
  readonly artistPhoto?: Image

  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly priority?: number

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string

  @IsOptional()
  readonly pictures?: Image

  @IsOptional()
  readonly paintings?: Painting[]
}
