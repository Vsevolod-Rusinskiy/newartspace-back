import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'
import { Painting } from 'src/paintings/models/painting.model'

export class UpdateArtistDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly artistName?: string

  @IsOptional()
  @IsString()
  readonly artistDescription?: string

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
  readonly pictures?: Image | null

  @IsOptional()
  readonly paintings?: Painting[]
}
