import { PartialType } from '@nestjs/swagger';
import { CreateSchoolDto } from './create-school.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
