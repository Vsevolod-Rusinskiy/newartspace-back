import {
  IsString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsArray
} from 'class-validator'

export class CreateOrderDto {
  @IsString()
  customerName: string

  @IsEmail()
  customerEmail: string

  @IsString()
  customerPhone: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  shippingAddress?: string

  @IsNumber()
  totalPrice: number

  @IsOptional()
  @IsNumber()
  userId?: number

  @IsArray()
  orderItems: {
    paintingId: number
    quantity: number
    price: number
  }[]
}
