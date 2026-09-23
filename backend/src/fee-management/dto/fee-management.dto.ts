import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  IsInt,
  IsEnum,
  IsDateString,
  IsArray,
  IsNumber,
  IsPositive,
  Max,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicYearStatus } from '../entities/academic-year.entity';
import { DiscountType } from '../entities/student-discount.entity';
import { FeeSchedule } from '../entities/fee-head.entity';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AcademicYearStatus })
  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ example: '2026' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  name?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AcademicYearStatus })
  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;
}

export const FEE_HEAD_CATEGORIES = [
  'brac_academy',
  'brac_primary',
  'brac_secondary',
] as const;

export class CreateFeeHeadDto {
  @ApiProperty({ example: 'Tuition Fee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ enum: FEE_HEAD_CATEGORIES })
  @IsOptional()
  @IsIn(FEE_HEAD_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional({ enum: FeeSchedule, default: FeeSchedule.MONTHLY })
  @IsOptional()
  @IsEnum(FeeSchedule)
  feeSchedule?: FeeSchedule;

  @ApiPropertyOptional({
    description: 'If true, students can pay this head line in installments',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  installmentAllowed?: boolean;

  @ApiPropertyOptional({ example: 'Monthly tuition charge' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeeHeadDto {
  @ApiPropertyOptional({ example: 'Tuition Fee' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ enum: FEE_HEAD_CATEGORIES })
  @IsOptional()
  @IsIn(FEE_HEAD_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional({ enum: FeeSchedule })
  @IsOptional()
  @IsEnum(FeeSchedule)
  feeSchedule?: FeeSchedule;

  @ApiPropertyOptional({
    description: 'If true, students can pay this head line in installments',
  })
  @IsOptional()
  @IsBoolean()
  installmentAllowed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SaveFeeStructureDto {
  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty({ example: 9, description: '1-12' })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    type: [Object],
    example: [{ feeHeadId: '<uuid>', amount: 2000 }],
  })
  @IsArray()
  @IsNotEmpty()
  lines: { feeHeadId: string; amount: number }[];
}

export class CreateStudentDiscountDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiPropertyOptional({ description: 'Omit for a total-fee discount' })
  @IsOptional()
  @IsUUID()
  feeHeadId?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({ example: 10, description: 'Percentage (0-100) or fixed amount' })
  @IsNumber()
  @IsPositive()
  value: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveFromMonth?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveToMonth?: number;

  @ApiPropertyOptional({ example: 'Sibling discount' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateStudentDiscountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  feeHeadId?: string;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveFromMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveToMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
