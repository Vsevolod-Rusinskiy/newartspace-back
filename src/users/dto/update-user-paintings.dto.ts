import { IsArray, IsNumber } from 'class-validator'

export class UpdateUserPaintingsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  favorites: number[]

  @IsArray()
  @IsNumber({}, { each: true })
  cart: number[]
}
