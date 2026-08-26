import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActionType } from '../entities/permission.entity';

export class CreatePermissionDto {
  @ApiProperty({ example: 'users' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({
    enum: ActionType,
    example: 'read',
  })
  @IsEnum(ActionType)
  action: ActionType;

  @ApiPropertyOptional({
    example: 'alumni',
    description:
      'Optional sub-resource within the module (e.g. a data-collection form key). Omit for a wildcard covering all resources in the module.',
  })
  @IsString()
  @IsOptional()
  resource?: string | null;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'School Admin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Manages school-level data' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  hierarchy?: number;

  @ApiPropertyOptional({ type: [CreatePermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePermissionDto)
  @IsOptional()
  permissions?: CreatePermissionDto[];
}
