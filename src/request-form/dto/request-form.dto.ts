import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsIn
} from 'class-validator'

export class RequestFormDto {
  @IsNotEmpty()
  name: string

  @IsNotEmpty()
  phone: string

  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  captcha?: string

  @IsOptional()
  @IsString()
  paintingName?: string

  @IsOptional()
  @IsString()
  formType?: string

  @IsOptional()
  @IsNumber()
  paintingId?: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  cartItemIds?: number[]

  @IsNotEmpty()
  @IsString()
  @IsIn(['delivery', 'pickup'])
  deliveryMethod: string
}
