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

  @ApiProperty({ enum: ActionType, example: 'read' })
  @IsEnum(ActionType)
  action: ActionType;
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
