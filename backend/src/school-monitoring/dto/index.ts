import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsIn,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class MonitoringAnswerDto {
  @IsString()
  code: string;

  @IsString()
  section: string;

  @IsIn(['yes', 'no', 'na', ''])
  result: 'yes' | 'no' | 'na' | '';

  @IsOptional()
  @IsString()
  comment?: string;
}

export class MonitoringAttachmentDto {
  @IsString()
  url: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateMonitoringSubmissionDto {
  @IsUUID()
  schoolId: string;

  @IsIn(['combined', 'quality', 'operations'])
  formType: 'combined' | 'quality' | 'operations';

  @IsOptional()
  @IsString()
  observerName?: string;

  @IsOptional()
  @IsString()
  teacherName?: string;

  @IsOptional()
  @IsDateString()
  observationDate?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonitoringAnswerDto)
  answers: MonitoringAnswerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonitoringAttachmentDto)
  attachments?: MonitoringAttachmentDto[];

  @IsOptional()
  @IsString()
  generalRemarks?: string;
}

export class UpdateMonitoringSubmissionDto extends PartialType(
  CreateMonitoringSubmissionDto,
) {}
