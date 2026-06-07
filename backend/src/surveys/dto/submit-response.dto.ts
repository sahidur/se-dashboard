import {
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  fieldId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  textValue?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  numberValue?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  booleanValue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  jsonValue?: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fileUrl?: string;
}

export class SubmitSurveyResponseDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  surveyId: string;

  @ApiPropertyOptional({
    description: 'School record ID to link this response to (for school-linked surveys)',
  })
  @IsUUID()
  @IsOptional()
  schoolRecordId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Save as draft (incomplete response)' })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @ApiPropertyOptional({ description: 'Existing draft response ID to update' })
  @IsUUID()
  @IsOptional()
  responseId?: string;

  @ApiProperty({ type: [SubmitAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}
