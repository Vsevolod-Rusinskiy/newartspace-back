import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsBoolean
} from 'class-validator'
import { Image } from '../../types/image.interface'
import { Type } from 'class-transformer'
export class UpdatePaintingDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  readonly attributes?: any[]

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
  readonly artStyle?: string

  @IsOptional()
  @IsString()
  readonly artType?: string

  @IsOptional()
  @IsNumber()
  readonly price?: number

  @IsOptional()
  @IsBoolean()
  readonly isReproducible?: boolean

  @IsOptional()
  @IsBoolean()
  readonly isAdult?: boolean

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
  @IsString()
  readonly color?: string

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  readonly colors?: number[]

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
