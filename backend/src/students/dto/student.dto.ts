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
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudentGender, StudentStatus } from '../entities/student.entity';

export class CreateClassDto {
  @ApiProperty({ example: 'Class 5' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  sequence?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ example: 'Class 5' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSectionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSectionDto {
  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStudentDto {
  @ApiProperty({ example: 'Rahim Ahmed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiPropertyOptional({ example: '2015-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: StudentGender })
  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;

  @ApiPropertyOptional({ example: 'Karim Ahmed' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  guardianName?: string;

  @ApiPropertyOptional({ example: '01712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guardianPhone?: string;

  @ApiPropertyOptional({ example: 'Village, Upazila, District' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'External reference / registry number' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Birth certificate ID' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  birthCertificateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string;

  @ApiPropertyOptional({ description: 'Language spoken at home' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  languageSpoken?: string;

  @ApiPropertyOptional({ description: 'Person with disability' })
  @IsOptional()
  @IsBoolean()
  isPwd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  motherDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  motherNid?: string;

  @ApiPropertyOptional({ description: 'Mother educational attainment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motherEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motherOccupation?: string;

  @ApiPropertyOptional({ description: 'Mother monthly income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  motherIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fatherDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fatherNid?: string;

  @ApiPropertyOptional({ description: 'Father educational attainment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherOccupation?: string;

  @ApiPropertyOptional({ description: 'Father monthly income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  fatherIncome?: string;

  @ApiPropertyOptional({ description: 'Combined parents income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  parentsIncome?: string;

  @ApiPropertyOptional({ description: 'Family involved with BRAC service' })
  @IsOptional()
  @IsBoolean()
  involveWithBracService?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOrphan?: boolean;

  @ApiPropertyOptional({ description: 'Attended other BRAC services' })
  @IsOptional()
  @IsBoolean()
  attendedBracOtherService?: boolean;

  @ApiPropertyOptional({ description: 'Participates with other NGOs' })
  @IsOptional()
  @IsBoolean()
  participateWithOtherNgo?: boolean;

  @ApiPropertyOptional({ description: 'Fee waiver percentage (0-100)' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  waiverPercent?: string;

  @ApiPropertyOptional({ description: 'bKash number (Bangladeshi phone)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bkashNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @ApiPropertyOptional({ example: '2026-01-05' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: 'Rahim Ahmed' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '2015-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: StudentGender })
  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;

  @ApiPropertyOptional({ example: 'Karim Ahmed' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  guardianName?: string;

  @ApiPropertyOptional({ example: '01712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guardianPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'External reference / registry number' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Birth certificate ID' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  birthCertificateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string;

  @ApiPropertyOptional({ description: 'Language spoken at home' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  languageSpoken?: string;

  @ApiPropertyOptional({ description: 'Person with disability' })
  @IsOptional()
  @IsBoolean()
  isPwd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  motherDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  motherNid?: string;

  @ApiPropertyOptional({ description: 'Mother educational attainment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motherEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motherOccupation?: string;

  @ApiPropertyOptional({ description: 'Mother monthly income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  motherIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fatherDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fatherNid?: string;

  @ApiPropertyOptional({ description: 'Father educational attainment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherOccupation?: string;

  @ApiPropertyOptional({ description: 'Father monthly income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  fatherIncome?: string;

  @ApiPropertyOptional({ description: 'Combined parents income (BDT)' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  parentsIncome?: string;

  @ApiPropertyOptional({ description: 'Family involved with BRAC service' })
  @IsOptional()
  @IsBoolean()
  involveWithBracService?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOrphan?: boolean;

  @ApiPropertyOptional({ description: 'Attended other BRAC services' })
  @IsOptional()
  @IsBoolean()
  attendedBracOtherService?: boolean;

  @ApiPropertyOptional({ description: 'Participates with other NGOs' })
  @IsOptional()
  @IsBoolean()
  participateWithOtherNgo?: boolean;

  @ApiPropertyOptional({ description: 'Fee waiver percentage (0-100)' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  waiverPercent?: string;

  @ApiPropertyOptional({ description: 'bKash number (Bangladeshi phone)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bkashNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @ApiPropertyOptional({ example: '2026-01-05' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class PromoteStudentsDto {
  @ApiProperty({ description: 'Target class for the promoted students' })
  @IsUUID()
  targetClassId: string;

  @ApiProperty({ description: 'Target section for the promoted students' })
  @IsUUID()
  targetSectionId: string;

  @ApiProperty({ description: 'Target academic year' })
  @IsUUID()
  targetAcademicYearId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}

export class TransferStudentDto {
  @ApiProperty({ description: 'Destination school' })
  @IsUUID()
  targetSchoolId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetSectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetAcademicYearId?: string;
}

export class ListStudentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ description: 'Search by name / guardian / phone' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
