import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSurveyAssignmentDto } from './create-survey.dto';

/**
 * Whitelisted body for POST /surveys/:id/assignments/bulk.
 *
 * Must stay a class so the global ValidationPipe applies nested validation
 * to each assignment (an untyped inline body bypassed validation entirely).
 */
export class BulkSurveyAssignmentsDto {
  @ApiProperty({ type: [CreateSurveyAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyAssignmentDto)
  assignments: CreateSurveyAssignmentDto[];
}
