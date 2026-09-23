import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  ValidateIf,
  Matches,
  IsDateString,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { normalizeGradeValue } from '../../common/utils/grade.utils';

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDcSchoolDto extends PartialType(CreateDcSchoolDto) {}

// ===================== Basic Information =====================

export class UpsertBasicInfoDto {
  @IsUUID()
  schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;
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

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

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
  @IsOptional() @IsString() @MaxLength(2000) classroomRenovationDetails?: string;
  @IsOptional() @IsBoolean() classroomEmergencyExit?: boolean;

  // ── Infrastructure Assets ──────────────────────────────────
  @IsOptional() @Type(() => Number) @IsNumber() infraTotalAssets?: number;
  @IsOptional() @Type(() => Number) @IsNumber() infraTotalProjectors?: number;
  @IsOptional() @Type(() => Number) @IsNumber() infraTotalLaptops?: number;
  @IsOptional() @Type(() => Number) @IsNumber() infraTotalPcs?: number;
}

// ===================== Students Info =====================

export class UpsertStudentsInfoDto {
  @IsUUID()
  schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  /** Full month name: 'January' … 'December' */
  @IsString() @IsNotEmpty() month: string;

  /**
   * Grade key: 'play_learn' | 'nursery' | 'g1' … 'g10'.
   * Historical spellings ("1", "Grade 1", "G1") are normalized so legacy
   * clients/drafts cannot fork records under a different vocabulary.
   */
  @Transform(({ value }) => normalizeGradeValue(value, 'slug'))
  @IsString() @IsNotEmpty() grade: string;

  @IsOptional() @Type(() => Number) @IsNumber() boys?: number;
  @IsOptional() @Type(() => Number) @IsNumber() girls?: number;
  @IsOptional() @Type(() => Number) @IsNumber() total?: number;
  @IsOptional() @Type(() => Number) @IsNumber() personsWithDisability?: number;
  @IsOptional() @Type(() => Number) @IsNumber() ethnic?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) attendanceRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) dropoutRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) replacedStudentsRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) retentionRate?: number;
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

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;
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

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;
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

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

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

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

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

  /** ISO date (yyyy-mm-dd) */
  @IsOptional() @IsDateString() joiningDate?: string;

  /** Bangladeshi mobile: 01XXXXXXXXX or +8801XXXXXXXXX (operator codes 13–19) */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(?:\+?880|0)1[3-9]\d{8}$/)
  phone?: string;

  /** ISO date (yyyy-mm-dd) */
  @IsOptional() @IsDateString() lastWorkingDay?: string;

  /** termination | resignation — presence makes separation details required */
  @IsOptional()
  @IsString()
  @IsIn(['termination', 'resignation'])
  separationType?: string;

  /** Required when separationType is provided */
  @ValidateIf((o) => o.separationType != null && o.separationType !== '')
  @IsString() @IsNotEmpty()
  @MaxLength(500)
  separationReason?: string;

  /** Required when separationType is provided */
  @ValidateIf((o) => o.separationType != null && o.separationType !== '')
  @IsString() @IsNotEmpty()
  @MaxLength(5000)
  separationNote?: string;
}

export class UpdateTeacherIndividualDto extends PartialType(CreateTeacherIndividualDto) {}

// ===================== Teachers Development (per month) =====================

export class UpsertTeachersDevelopmentDto {
  @IsUUID()
  schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) onlineRefresher?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offlineRefresher?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) developmentForum?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) basicTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) subjectBasedTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) leadershipTraining?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) others?: number;
  @IsOptional() @IsString() @MaxLength(255) othersTrainingName?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) teacherDropoutRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) headTeacherDropoutRate?: number;
  @IsOptional() @IsBoolean() headTeacherLeadershipGood?: boolean;
  @IsOptional() @IsString() @IsIn(['strong', 'moderate', 'weak']) headTeacherLeadership?: string;
}

// ===================== Fee Structure =====================

export class UpsertFeeStructureDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @IsString() @IsNotEmpty() month: string;

  @Transform(({ value }) => normalizeGradeValue(value, 'label'))
  @IsString()
  @IsIn(['Play & Learn', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'])
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
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exerciseBookFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) labLibraryFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) projectClubFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscRegistrationFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) boatFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment1Fee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment2Fee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) formativeAssessmentFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) classroomLibraryFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) eventFee?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) playActivityFee?: number;
}

// ===================== Revenue Budget Total =====================

export class UpsertRevenueBudgetTotalDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

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
  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;
  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeAchievement?: number;

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

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFormTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFormAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exerciseBookFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exerciseBookFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) labLibraryFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) labLibraryFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) projectClubFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) projectClubFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscRegistrationFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscRegistrationFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) boatFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) boatFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment1FeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment1FeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment2FeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment2FeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) formativeAssessmentFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) formativeAssessmentFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) classroomLibraryFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) classroomLibraryFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) eventFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) eventFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) playActivityFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) playActivityFeeAchievement?: number;
}

// ===================== Revenue Actual Total =====================

export class UpsertRevenueActualTotalDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

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
  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;
  @IsString() @IsNotEmpty() month: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFeeAchievement?: number;

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

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFormTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) admissionFormAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) testimonialFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exerciseBookFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exerciseBookFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) labLibraryFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) labLibraryFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) projectClubFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) projectClubFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscRegistrationFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscRegistrationFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) boatFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) boatFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment1FeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment1FeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment2FeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) terminalAssessment2FeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) formativeAssessmentFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) formativeAssessmentFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) classroomLibraryFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) classroomLibraryFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) eventFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) eventFeeAchievement?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) playActivityFeeTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) playActivityFeeAchievement?: number;
}

// ===================== Pedagogical Achievement =====================

export class UpsertPedagogicalAchievementDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) year: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kgParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kgScholarship?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) primaryParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) primaryScholarship?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) jrParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) jrScholarship?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sscScholarship?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersScholarship?: number;

  // Sir Fazle Hasan Abed Talent Grants
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) talentGrantParticipated?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) talentGrantAwarded?: number;
}

// ===================== Co-curricular =====================

export class UpsertCocurricularDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @IsString() @IsNotEmpty() month: string;

  @Transform(({ value }) => normalizeGradeValue(value, 'label'))
  @IsString()
  @IsIn(['Play & Learn', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'])
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

// ===================== Students' Performance =====================

export class UpsertStudentsPerformanceDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @Transform(({ value }) => normalizeGradeValue(value, 'short'))
  @IsString()
  @IsIn(['Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'])
  grade: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) numberOfStudents?: number;

  @IsString()
  @IsIn(['Half-yearly', 'Annual'])
  examName: string;

  // Students now reported as a count, not a percentage — Max(100) removed.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) studentsAppearedPercent?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeAPlus?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeA?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeAMinus?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeB?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeC?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeD?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeF?: number;

  // ── BRAC Academy grade scale ──────────────────────────────
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) academyExcellent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) academyGood?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) academySatisfactory?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) academyImprovementNeeded?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) progressGood?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) progressSatisfactory?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) progressNeedImprove?: number;
}

// ===================== Student Performance (BA / BPS / BSS) =====================

export const STUDENT_PERFORMANCE_FORM_KEYS = ['ba-1', 'ba-2', 'ba-3a', 'ba-3b', 'bps-1', 'bps-2', 'bss-1'] as const;

export class StudentPerformanceRowDto {
  @IsString() @IsNotEmpty() code: string;

  @IsString() @IsNotEmpty() label: string;

  @IsOptional() @IsString() domain?: string;

  /** Scale label -> number of students. Values are validated/normalised in the service. */
  @IsObject() values: Record<string, number>;
}

export class UpsertStudentPerformanceDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @IsString() @IsIn(STUDENT_PERFORMANCE_FORM_KEYS as unknown as string[])
  formKey: string;

  @IsString() @IsNotEmpty() grade: string;

  @IsString() @IsIn(['Half-yearly', 'Annual'])
  evaluationPeriod: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) numberOfStudents?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) appearedPercent?: number;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => StudentPerformanceRowDto)
  rows: StudentPerformanceRowDto[];
}

// ===================== Activity Participation (Corner/Club/Library/Lab) =====================

export class UpsertActivityParticipationDto {
  @IsUUID() schoolId: string;

  @IsString()
  @IsIn([
    'Corner activity',
    'Language & Literacy club',
    'Nature & Environment club',
    'Music club',
    'Creative club',
    'Science & Technology club',
    'Science lab',
    'ICT lab',
    'Agriculture lab',
    'Use of library',
    'Creativity Corner',
    'Critical thinking Corner',
    'Physical Activity Corner',
    'Computer lab',
    'Classroom Library',
  ])
  item: string;

  @Type(() => Number) @IsNumber() @Min(1990) year: number;

  @IsString() @IsNotEmpty() month: string;

  @Transform(({ value }) => normalizeGradeValue(value, 'short'))
  @IsString()
  @IsIn(['Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'])
  grade: string;

  @IsOptional() @IsString() activityName?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() photoKey?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) conductedCount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) participationRate?: number;
}

// ===================== Event Participation =====================

export class CreateEventParticipationDto {
  @IsUUID() schoolId: string;

  @Type(() => Number) @IsNumber() @Min(1990) academicYear: number;

  @IsString() @IsNotEmpty() eventName: string;

  @IsString()
  @IsIn(['School', 'Upazila', 'Zila', 'Divisional', 'National'])
  awardLevel: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maleAwarded?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) femaleAwarded?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) othersAwarded?: number;
}

export class UpdateEventParticipationDto extends PartialType(CreateEventParticipationDto) {}

// ===================== Form Draft (server-side, per-user) =====================

export class UpsertFormDraftDto {
  @IsUUID() schoolId: string;

  @IsString() @IsNotEmpty() formKey: string;

  // NOTE: must have at least one class-validator decorator or the global
  // ValidationPipe's `whitelist`/`forbidNonWhitelisted` options strip/reject
  // it as an "unknown" property (400 "property data should not exist"),
  // even though it's intentionally an arbitrary JSON blob (jsonb column).
  @IsObject()
  data: Record<string, unknown>;
}
