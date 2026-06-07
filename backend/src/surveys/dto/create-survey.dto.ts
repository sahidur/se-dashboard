import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SurveyStatus, LinkedEntityType } from '../entities/survey.entity';
import { FieldType } from '../entities/survey-field.entity';

export class CreateSurveyFieldDto {
  @ApiProperty({ example: 'What is your name?' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ example: 'student_name', description: 'Unique field name/slug for analytics' })
  @IsString()
  @IsOptional()
  fieldName?: string;

  @ApiProperty({ enum: FieldType, example: 'short_text' })
  @IsEnum(FieldType)
  fieldType: FieldType;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: ['Option A', 'Option B'] })
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  validationRules?: Record<string, any>;

  @ApiPropertyOptional({ example: 'Enter your name' })
  @IsString()
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional({ example: 'Your legal first name' })
  @IsString()
  @IsOptional()
  helpText?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: 'image/*,.pdf' })
  @IsString()
  @IsOptional()
  allowedFileTypes?: string;

  @ApiPropertyOptional({ example: 5242880 })
  @IsNumber()
  @IsOptional()
  maxFileSize?: number;

  @ApiPropertyOptional({ description: 'Section ID this field belongs to' })
  @IsUUID()
  @IsOptional()
  sectionId?: string;
}

export class CreateSurveySectionDto {
  @ApiProperty({ example: 'Personal Information' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Basic personal details' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiProperty({ type: [CreateSurveyFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyFieldDto)
  fields: CreateSurveyFieldDto[];
}

export class CreateSurveyAssignmentDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'User IDs to exclude when assigning to a role' })
  @IsArray()
  @IsOptional()
  excludeUserIds?: string[];
}

export class CreateSurveyDto {
  @ApiProperty({ example: 'Annual School Assessment 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Comprehensive assessment for all schools' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'education' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsEnum(SurveyStatus)
  @IsOptional()
  status?: SurveyStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    enum: LinkedEntityType,
    description: 'Whether responses must be linked to a school record',
  })
  @IsEnum(LinkedEntityType)
  @IsOptional()
  linkedEntityType?: LinkedEntityType;

  @ApiPropertyOptional({
    description:
      'If true, completing this survey creates a school record for the respondent',
  })
  @IsBoolean()
  @IsOptional()
  createsSchoolRecord?: boolean;

  @ApiPropertyOptional({ type: [CreateSurveyFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyFieldDto)
  @IsOptional()
  fields?: CreateSurveyFieldDto[];

  @ApiPropertyOptional({ type: [CreateSurveySectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveySectionDto)
  @IsOptional()
  sections?: CreateSurveySectionDto[];

  @ApiPropertyOptional({ type: [CreateSurveyAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyAssignmentDto)
  @IsOptional()
  assignments?: CreateSurveyAssignmentDto[];
}
