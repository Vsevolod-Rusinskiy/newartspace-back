import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator'

export class UpdateArtistDto {
  @IsOptional()
  @IsString()
  readonly artistName?: string

  @IsOptional()
  @IsString()
  readonly artistDescription?: string

  @IsOptional()
  @IsString()
  readonly artistUrl?: string

  @IsOptional()
  @IsInt()
  readonly priority?: number

  @IsOptional()
  @IsDateString()
  readonly createdAt?: string

  @IsOptional()
  @IsDateString()
  readonly updatedAt?: string
}
