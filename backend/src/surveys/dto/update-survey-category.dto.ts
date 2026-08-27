import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Whitelisted fields for PATCH /surveys/categories/:categoryId.
 *
 * This must stay a class (not an inline interface): the global ValidationPipe
 * only validates/whitelists class metatypes, and the service Object.assigns
 * the payload onto the entity — an untyped body would let a caller set any
 * column (deletedAt, createdAt, …) via mass assignment.
 */
export class UpdateSurveyCategoryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
