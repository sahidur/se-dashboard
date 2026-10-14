import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Whitelisted fields for POST /surveys/categories.
 *
 * Must stay a class (not an inline type): the global ValidationPipe only
 * validates/whitelists class metatypes, so an untyped body received no
 * validation at all (unbounded strings, type-confused sortOrder, ...).
 * Mirrors UpdateSurveyCategoryDto, which was already converted.
 */
export class CreateSurveyCategoryDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
