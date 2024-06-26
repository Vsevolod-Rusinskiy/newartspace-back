import {
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator'

export class CreatePaintingDto {
  @IsNotEmpty()
  @IsString()
  readonly paintingUrl: string

  @IsNotEmpty()
  @IsString()
  readonly author: string

  @IsNotEmpty()
  @IsString()
  readonly name: string

  @IsNotEmpty()
  @IsString()
  readonly artType: string

  @IsNotEmpty()
  @IsNumber()
  readonly price: number

  @IsNotEmpty()
  @IsString()
  readonly theme: string

  @IsNotEmpty()
  @IsString()
  readonly style: string

  @IsNotEmpty()
  @IsString()
  readonly base: string

  @IsNotEmpty()
  @IsString()
  readonly materials: string

  @IsNotEmpty()
  @IsNumber()
  readonly height: number

  @IsNotEmpty()
  @IsNumber()
  readonly width: number

  @IsNotEmpty()
  @IsInt()
  @Min(1000)
  @Max(9999)
  readonly yearOfCreation: number

  @IsNotEmpty()
  @IsString()
  readonly format: string

  @IsNotEmpty()
  @IsString()
  readonly color: string
}
