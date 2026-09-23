import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class AopTargetLineDto {
  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty({ example: 30, description: 'Planned (AOP) number of students for this class' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetStudents: number;
}

export class SaveAopTargetsDto {
  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiProperty({ type: [AopTargetLineDto], example: [{ classId: '<uuid>', targetStudents: 30 }] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AopTargetLineDto)
  lines: AopTargetLineDto[];
}