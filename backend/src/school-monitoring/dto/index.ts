import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsIn,
  ValidateNested,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class MonitoringAnswerDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(200)
  section: string;

  @IsIn(['yes', 'no', 'na', ''])
  result: 'yes' | 'no' | 'na' | '';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class MonitoringAttachmentDto {
  @IsString()
  @MaxLength(2048)
  url: string;

  @IsString()
  @MaxLength(512)
  key: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  type?: string;
}

export class CreateMonitoringSubmissionDto {
  @IsUUID()
  schoolId: string;

  @IsIn(['combined', 'quality', 'operations'])
  formType: 'combined' | 'quality' | 'operations';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  observerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  teacherName?: string;

  @IsOptional()
  @IsDateString()
  observationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  className?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MonitoringAnswerDto)
  answers: MonitoringAnswerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MonitoringAttachmentDto)
  attachments?: MonitoringAttachmentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  generalRemarks?: string;
}

export class UpdateMonitoringSubmissionDto extends PartialType(
  CreateMonitoringSubmissionDto,
) {}
