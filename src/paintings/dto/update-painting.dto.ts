import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
} from 'class-validator';

export class UpdatePaintingDto {
  @IsOptional()
  @IsString()
  readonly name?: string; // Название картины

  @IsOptional()
  @IsString()
  readonly artType?: string; // Вид искусства

  @IsOptional()
  @IsNumber()
  readonly price?: number; // Цена

  @IsOptional()
  @IsString()
  readonly theme?: string; // Тематика

  @IsOptional()
  @IsString()
  readonly style?: string; // Стиль

  @IsOptional()
  @IsString()
  readonly base?: string; // Основа

  @IsOptional()
  @IsString()
  readonly materials?: string; // Материалы

  @IsOptional()
  @IsString()
  readonly dimensions?: string; // Размеры

  @IsInt()
  @Min(1000)
  @Max(9999)
  readonly yearOfCreation?: number; // Год создания, четырёхзначное число

  @IsOptional()
  @IsString()
  readonly format?: string; // Формат

  @IsOptional()
  @IsString()
  readonly color?: string; // Цвет
}
