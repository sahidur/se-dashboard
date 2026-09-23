import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  ArrayNotEmpty,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/payment.entity';

export class GenerateFeesDto {
  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiProperty({ example: 9, description: '1-12' })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: 'Restrict generation to one class' })
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class PaymentAllocationDto {
  @ApiProperty({ description: 'Fee head this part of the payment covers' })
  @IsUUID()
  feeHeadId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CollectPaymentDto {
  @ApiProperty({ description: 'Student fee (month) the payment is for' })
  @IsUUID()
  studentFeeId: string;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    type: [PaymentAllocationDto],
    description:
      'Head-wise split of the payment. Omit to pay all heads at once. ' +
      'Heads without installment allowed must be paid in full; installment heads accept partial amounts.',
  })
  @IsOptional()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Transaction / reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  transactionRef?: string;

  @ApiPropertyOptional({ description: 'Bank / MFS name for non-cash' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bankName?: string;

  @ApiPropertyOptional({ example: '2026-09-20' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

export class CancelPaymentDto {
  @ApiProperty({ example: 'Duplicate receipt' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
