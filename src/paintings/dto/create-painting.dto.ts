import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  IsDateString
} from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'
import { Attributes } from 'src/attributes/models/attributes.model'

export class CreatePaintingDto {
  @IsOptional()
  @IsString()
  readonly imgUrl?: string

  @IsOptional()
  @IsNumber()
  readonly artistId?: number

  @IsOptional()
  @IsString()
  readonly title?: string

  @IsOptional()
  @IsString()
  readonly artStyle?: string

  @IsOptional()
  @IsString()
  readonly artType?: string

  @IsOptional()
  @IsNumber()
  readonly price?: number

  @IsOptional()
  @IsNumber()
  readonly discount?: number

  @IsOptional()
  @IsString()
  readonly style?: string

  @IsOptional()
  @IsString()
  readonly priceType?: string

  @IsOptional()
  @IsString()
  readonly theme?: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  readonly themes?: number[]

  @IsOptional()
  @IsString()
  readonly material?: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  readonly materials?: number[]

  @IsOptional()
  @IsString()
  readonly technique?: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  readonly techniques?: number[]

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
  readonly pictures?: Image

  @IsOptional()
  readonly attributes?: Attributes[]
}
