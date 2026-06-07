import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEmail,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

// ===================== School DTOs =====================

export class CreateDcSchoolDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  upazila?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  principalName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  establishedYear?: number;

  @IsOptional()
  @IsString()
  schoolType?: string;

  @IsOptional()
  @IsString()
  schoolCategory?: string;

  @IsOptional()
  @IsBoolean()
  governmentApproval?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalTeachers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalStudents?: number;

  @IsOptional()
  @IsString()
  gradeCoverage?: string;
}

export class UpdateDcSchoolDto extends PartialType(CreateDcSchoolDto) {}

// ===================== Basic Information =====================

export class UpsertBasicInfoDto {
  @IsUUID()
  schoolId: string;

  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @IsString() schoolCategory?: string;
  @IsOptional() @IsString() mediumOfInstruction?: string;
  @IsOptional() @IsString() shiftSystem?: string;
  @IsOptional() @IsBoolean() hasPlayground?: boolean;
  @IsOptional() @IsBoolean() hasLibrary?: boolean;
  @IsOptional() @IsBoolean() hasComputerLab?: boolean;
  @IsOptional() @IsBoolean() hasScienceLab?: boolean;
  @IsOptional() @IsBoolean() hasElectricity?: boolean;
  @IsOptional() @IsBoolean() hasInternet?: boolean;
  @IsOptional() @IsBoolean() hasDrinkingWater?: boolean;
  @IsOptional() @IsBoolean() hasSanitaryFacilities?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() totalClassrooms?: number;
  @IsOptional() @Type(() => Number) @IsNumber() operationalClassrooms?: number;
  @IsOptional() @IsString() additionalNotes?: string;
}

// ===================== Infrastructure =====================

export class UpsertInfrastructureDto {
  @IsUUID()
  schoolId: string;

  // ── Infrastructure Status ──────────────────────────────────
  @IsOptional() @IsString() campusStatus?: string;
  @IsOptional() @IsString() buildingStatus?: string; // JSON array string

  // Room counts
  @IsOptional() @Type(() => Number) @IsNumber() roomHeadTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomClassroom?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomPlayroom?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomLibrary?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomLab?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomStoreroom?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomKitchen?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomSickbay?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomOthers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roomTotal?: number;

  // Washrooms
  @IsOptional() @Type(() => Number) @IsNumber() washroomMale?: number;
  @IsOptional() @Type(() => Number) @IsNumber() washroomFemale?: number;

  // Facility booleans
  @IsOptional() @IsBoolean() hasHandWashPoint?: boolean;
  @IsOptional() @IsBoolean() hasPlayground?: boolean;
  @IsOptional() @IsBoolean() hasSchoolGarden?: boolean;
  @IsOptional() @IsBoolean() infraRenovationRequired?: boolean;

  // ── Classroom Status ───────────────────────────────────────
  @IsOptional() @Type(() => Number) @IsNumber() digitallyEquippedClassrooms?: number;
  @IsOptional() @Type(() => Number) @IsNumber() floorSittingClassrooms?: number;
  @IsOptional() @Type(() => Number) @IsNumber() classroomsWithWhiteboard?: number;
  @IsOptional() @Type(() => Number) @IsNumber() classroomsWithBlackboard?: number;
  @IsOptional() @IsBoolean() classroomNewFurniture?: boolean;
  @IsOptional() @IsBoolean() classroomRenovationRequired?: boolean;
}

// ===================== Students Info =====================

export class UpsertStudentsInfoDto {
  @IsUUID()
  schoolId: string;

  /** Full month name: 'January' … 'December' */
  @IsString() @IsNotEmpty() month: string;

  /** Grade key: 'play_learn' | 'nursery' | 'g1' … 'g5' */
  @IsString() @IsNotEmpty() grade: string;

  @IsOptional() @Type(() => Number) @IsNumber() boys?: number;
  @IsOptional() @Type(() => Number) @IsNumber() girls?: number;
  @IsOptional() @Type(() => Number) @IsNumber() total?: number;
  @IsOptional() @Type(() => Number) @IsNumber() personsWithDisability?: number;
  @IsOptional() @Type(() => Number) @IsNumber() ethnic?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) attendanceRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) dropoutRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() remedialSupport?: number;
}

// ===================== Teachers Info =====================

export class UpsertTeachersInfoDto {
  @IsUUID()
  schoolId: string;

  @IsOptional() @Type(() => Number) @IsNumber() totalTeachersMale?: number;
  @IsOptional() @Type(() => Number) @IsNumber() totalTeachersFemale?: number;
  @IsOptional() @Type(() => Number) @IsNumber() permanentTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() contractTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() trainedTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() untrainedTeachers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() avgExperienceYears?: number;
  @IsOptional() @IsString() teacherStudentRatio?: string;
  @IsOptional() @Type(() => Number) @IsNumber() vacantPositions?: number;
  @IsOptional() @Type(() => Number) @IsNumber() teachersWithBEd?: number;
  @IsOptional() @Type(() => Number) @IsNumber() teachersWithMEd?: number;
  @IsOptional() @IsString() remarks?: string;
}

// ===================== Revenue =====================

export class UpsertRevenueDto {
  @IsUUID()
  schoolId: string;

  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @Type(() => Number) @IsNumber() monthlyTuitionFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() admissionFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() examFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() totalAnnualRevenue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() governmentGrant?: number;
  @IsOptional() @Type(() => Number) @IsNumber() donationsReceived?: number;
  @IsOptional() @Type(() => Number) @IsNumber() otherIncome?: number;
  @IsOptional() @Type(() => Number) @IsNumber() totalExpenditure?: number;
  @IsOptional() @Type(() => Number) @IsNumber() salaryExpenditure?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maintenanceExpenditure?: number;
  @IsOptional() @Type(() => Number) @IsNumber() pendingFeeAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() feeCollectionRate?: number;
  @IsOptional() @IsString() remarks?: string;
}

// ===================== Performance =====================

export class UpsertPerformanceDto {
  @IsUUID()
  schoolId: string;

  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @Type(() => Number) @IsNumber() avgPassRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() avgGpa?: number;
  @IsOptional() @Type(() => Number) @IsNumber() boardExamPassRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() boardExamAvgGpa?: number;
  @IsOptional() @IsString() extracurricularActivities?: string;
  @IsOptional() @IsString() sportsAchievements?: string;
  @IsOptional() @IsString() culturalActivities?: string;
  @IsOptional() @Type(() => Number) @IsNumber() scienceFairParticipation?: number;
  @IsOptional() @Type(() => Number) @IsNumber() debateCompetitions?: number;
  @IsOptional() @Type(() => Number) @IsNumber() totalAwards?: number;
  @IsOptional() @IsString() teachingMethodology?: string;
  @IsOptional() @IsString() remarks?: string;
}

// ===================== Alumni =====================

export class CreateAlumniDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  alumniName: string;

  @IsOptional() @Type(() => Number) @IsNumber() graduationYear?: number;
  @IsOptional() @IsString() presentAddress?: string;
  @IsOptional() @IsString() currentOccupation?: string;
  @IsOptional() @IsString() higherEducation?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() achievements?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() remarks?: string;
}

export class UpdateAlumniDto extends PartialType(CreateAlumniDto) {}

// ===================== Teacher Individual (multi-entry) =====================

export class CreateTeacherIndividualDto {
  @IsUUID()
  schoolId: string;

  @IsString() @IsNotEmpty() name: string;

  @IsString()
  @IsIn(['Head Teacher', 'Assistant Teacher', 'Junior Teacher'])
  designation: string;

  @IsString()
  @IsIn(['Male', 'Female'])
  gender: string;

  @IsString()
  @IsIn(['HSC', 'Hons', 'Masters'])
  educationalQualification: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) experienceYears?: number;

  /** Comma-separated: Math, Science, Bangla, English, Others, <custom> */
  @IsOptional() @IsString() subjectExpertise?: string;

  /** Comma-separated: Basic, Subject-based, Leadership, Others, <custom> */
  @IsOptional() @IsString() trainingReceived?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) assessmentScore?: number;
}

// ===================== Teachers Development (per month) =====================

export class UpsertTeachersDevelopmentDto {
  @IsUUID()
  schoolId: string;

  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) onlineRefresher?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offlineRefresher?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) developmentForum?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) basicTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) subjectBasedTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) leadershipTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) others?: number;
}

// ===================== Fee Structure =====================

export class UpsertFeeStructureDto {
  @IsUUID() schoolId: string;

  @IsString() @IsNotEmpty() month: string;

  @IsString()
  @IsIn(['Play', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'])
  grade: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sessionFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) assessmentFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sportsFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) syllabusFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionForm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFee?: number;
}

// ===================== Revenue Budget Total =====================

export class UpsertRevenueBudgetTotalDto {
  @IsUUID() schoolId: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalStudentsTarget?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sessionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sessionFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) assessmentFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) assessmentFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sportsFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sportsFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) syllabusFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) syllabusFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeAchievement?: number;
}

// ===================== Revenue Budget Monthly =====================

export class UpsertRevenueBudgetMonthlyDto {
  @IsUUID() schoolId: string;
  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeAchievement?: number;
}

// ===================== Revenue Actual Total =====================

export class UpsertRevenueActualTotalDto {
  @IsUUID() schoolId: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalStudentsTarget?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sessionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sessionFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) assessmentFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) assessmentFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sportsFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sportsFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) syllabusFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) syllabusFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeAchievement?: number;
}

// ===================== Revenue Actual Monthly =====================

export class UpsertRevenueActualMonthlyDto {
  @IsUUID() schoolId: string;
  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeAchievement?: number;
}

// ===================== Pedagogical Achievement =====================

export class UpsertPedagogicalAchievementDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) year: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kgScholarship?: number;
  @IsOptional() @IsString() kgUniqueApproach?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) primaryScholarship?: number;
  @IsOptional() @IsString() primaryUniqueApproach?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) jrScholarship?: number;
  @IsOptional() @IsString() jrUniqueApproach?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscScholarship?: number;
  @IsOptional() @IsString() sscUniqueApproach?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersScholarship?: number;
  @IsOptional() @IsString() othersUniqueApproach?: string;
}

// ===================== Co-curricular =====================

export class UpsertCocurricularDto {
  @IsUUID() schoolId: string;

  @IsString() @IsNotEmpty() month: string;

  @IsString()
  @IsIn(['Play', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'])
  grade: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) song?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) dance?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) recitation?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) acting?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) debate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) quiz?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) wallMagazine?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) indoorGame?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) outdoorGame?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) others?: number;
}
