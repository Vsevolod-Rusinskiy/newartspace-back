import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString
} from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'

export class UpdatePaintingDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsNumber()
  readonly artistId?: number

  @IsOptional()
  @IsString()
  readonly prevImgUrl?: string

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
  @IsString()
  readonly techniques?: string

  @IsOptional()
  @IsNumber()
  readonly height?: number

  @IsOptional()
  @IsNumber()
  readonly width?: number

  @IsOptional()
  @IsInt()
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
  @IsInt()
  @Type(() => Number)
  readonly priority?: number

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string

  @IsOptional()
  readonly pictures?: Image | null
}
