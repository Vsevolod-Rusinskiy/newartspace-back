import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
  IsNotEmpty,
} from 'class-validator'

export class UpdatePaintingDto {
  @IsNotEmpty()
  @IsString()
  readonly paintingUrl?: string

  @IsNotEmpty()
  @IsString()
  readonly author?: string

  @IsOptional()
  @IsString()
  readonly prevPaintingUrl?: string

  @IsOptional()
  @IsString()
  readonly name?: string

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
  readonly base?: string

  @IsOptional()
  @IsString()
  readonly materials?: string

  @IsOptional()
  @IsNumber()
  readonly height?: number

  @IsOptional()
  @IsNumber()
  readonly width?: number

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
}
