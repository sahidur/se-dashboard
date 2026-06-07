import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeoLocationType } from '../entities/geo-location.entity';

export class CreateGeoLocationDto {
  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: GeoLocationType, example: 'division' })
  @IsEnum(GeoLocationType)
  type: GeoLocationType;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateGeoLocationDto {
  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: GeoLocationType })
  @IsEnum(GeoLocationType)
  @IsOptional()
  type?: GeoLocationType;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
