import {
  IsString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsArray
} from 'class-validator'

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  customerName?: string

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsString()
  customerPhone?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  shippingAddress?: string

  @IsOptional()
  @IsNumber()
  totalPrice?: number

  @IsOptional()
  @IsNumber()
  statusId?: number

  @IsOptional()
  @IsNumber()
  userId?: number

  @IsOptional()
  @IsArray()
  orderItems?: {
    paintingId: number
    quantity: number
    price: number
  }[]
}
