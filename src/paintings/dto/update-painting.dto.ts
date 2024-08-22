import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
  IsDateString
} from 'class-validator'
import { Image } from '../../types/image.interface'

export class UpdatePaintingDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly paintingUrl?: string

  @IsOptional()
  @IsString()
  readonly author?: string

  @IsOptional()
  @IsString()
  readonly prevPaintingUrl?: string

  @IsOptional()
  @IsString()
  readonly title?: string

  @IsOptional()
  @IsString()
  readonly artType?: string

  @IsOptional()
  @IsNumber()
  readonly price?: number

  @IsOptional()
  @IsString()
  readonly theme?: string

  @IsOptional()
  @IsString()
  readonly style?: string

  @IsOptional()
  @IsString()
  readonly materials?: string

  @IsOptional()
  @IsNumber()
  readonly height?: number

  @IsOptional()
  @IsNumber()
  readonly width?: number

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(9999)
  readonly yearOfCreation?: number

  @IsOptional()
  @IsString()
  readonly format?: string

  @IsOptional()
  @IsString()
  readonly color?: string

  @IsOptional()
  @IsString()
  readonly description?: string

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string

  @IsOptional()
  readonly pictures?: Image | null
}
