import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'
import { Image } from '../../types/image.interface'

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
  readonly artistUrl?: string

  @IsOptional()
  @IsInt()
  readonly priority?: number

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string
}
