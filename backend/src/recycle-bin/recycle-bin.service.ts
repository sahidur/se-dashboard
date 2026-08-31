import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Survey } from '../surveys/entities/survey.entity';
import { User } from '../users/entities/user.entity';
import { SurveyCategory } from '../surveys/entities/survey-category.entity';
import { SchoolRecord } from '../surveys/entities/school-record.entity';
import { School } from '../schools/entities/school.entity';
import { GeoLocation } from '../geo-locations/entities/geo-location.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { DcTeacherIndividual } from '../data-collection/entities/dc-teacher-individual.entity';
import { DcAlumni } from '../data-collection/entities/dc-alumni.entity';
import { DcPedagogicalAchievement } from '../data-collection/entities/dc-pedagogical-achievement.entity';
import { DcCocurricular } from '../data-collection/entities/dc-cocurricular.entity';
import { DcStudentsPerformance } from '../data-collection/entities/dc-students-performance.entity';
import { DcStudentPerformance } from '../data-collection/entities/dc-student-performance.entity';
import { DcActivityParticipation } from '../data-collection/entities/dc-activity-participation.entity';
import { DcEventParticipation } from '../data-collection/entities/dc-event-participation.entity';
import { DcFeeStructure } from '../data-collection/entities/dc-fee-structure.entity';
import { DcInfrastructure } from '../data-collection/entities/dc-infrastructure.entity';
import { DcStudentsInfo } from '../data-collection/entities/dc-students-info.entity';
import { DcTeachersDevelopment } from '../data-collection/entities/dc-teachers-development.entity';
import { DcRevenueBudgetTotal } from '../data-collection/entities/dc-revenue-budget-total.entity';
import { DcRevenueBudgetMonthly } from '../data-collection/entities/dc-revenue-budget-monthly.entity';
import { DcRevenueActualTotal } from '../data-collection/entities/dc-revenue-actual-total.entity';
import { DcRevenueActualMonthly } from '../data-collection/entities/dc-revenue-actual-monthly.entity';

export type RecycleBinEntityType =
  | 'survey'
  | 'user'
  | 'category'
  | 'school-record'
  | 'school'
  | 'geo-location'
  | 'dc-alumni'
  | 'dc-teacher-individual'
  | 'dc-pedagogical-achievement'
  | 'dc-cocurricular'
  | 'dc-students-performance'
  | 'dc-student-performance'
  | 'dc-activity-participation'
  | 'dc-event-participation'
  | 'dc-fee-structure'
  | 'dc-infrastructure'
  | 'dc-students-info'
  | 'dc-teachers-development'
  | 'dc-revenue-budget-total'
  | 'dc-revenue-budget-monthly'
  | 'dc-revenue-actual-total'
  | 'dc-revenue-actual-monthly';

// Enum object used for runtime validation via ParseEnumPipe
export const RECYCLE_BIN_ENTITY_TYPES = {
  SURVEY: 'survey',
  USER: 'user',
  CATEGORY: 'category',
  SCHOOL_RECORD: 'school-record',
  SCHOOL: 'school',
  GEO_LOCATION: 'geo-location',
  DC_ALUMNI: 'dc-alumni',
  DC_TEACHER_INDIVIDUAL: 'dc-teacher-individual',
  DC_PEDAGOGICAL_ACHIEVEMENT: 'dc-pedagogical-achievement',
  DC_COCURRICULAR: 'dc-cocurricular',
  DC_STUDENTS_PERFORMANCE: 'dc-students-performance',
  DC_STUDENT_PERFORMANCE: 'dc-student-performance',
  DC_ACTIVITY_PARTICIPATION: 'dc-activity-participation',
  DC_EVENT_PARTICIPATION: 'dc-event-participation',
  DC_FEE_STRUCTURE: 'dc-fee-structure',
  DC_INFRASTRUCTURE: 'dc-infrastructure',
  DC_STUDENTS_INFO: 'dc-students-info',
  DC_TEACHERS_DEVELOPMENT: 'dc-teachers-development',
  DC_REVENUE_BUDGET_TOTAL: 'dc-revenue-budget-total',
  DC_REVENUE_BUDGET_MONTHLY: 'dc-revenue-budget-monthly',
  DC_REVENUE_ACTUAL_TOTAL: 'dc-revenue-actual-total',
  DC_REVENUE_ACTUAL_MONTHLY: 'dc-revenue-actual-monthly',
} as const;

@Injectable()
export class RecycleBinService {
  constructor(
    @InjectRepository(Survey)
    private surveysRepo: Repository<Survey>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(SurveyCategory)
    private categoriesRepo: Repository<SurveyCategory>,
    @InjectRepository(SchoolRecord)
    private schoolRecordsRepo: Repository<SchoolRecord>,
    @InjectRepository(School)
    private schoolsRepo: Repository<School>,
    @InjectRepository(GeoLocation)
    private geoLocationsRepo: Repository<GeoLocation>,
    @InjectRepository(DcTeacherIndividual)
    private dcTeacherIndividualsRepo: Repository<DcTeacherIndividual>,
    @InjectRepository(DcAlumni)
    private dcAlumniRepo: Repository<DcAlumni>,
    @InjectRepository(DcPedagogicalAchievement)
    private dcPedagogicalAchievementsRepo: Repository<DcPedagogicalAchievement>,
    @InjectRepository(DcCocurricular)
    private dcCocurricularRepo: Repository<DcCocurricular>,
    @InjectRepository(DcStudentsPerformance)
    private dcStudentsPerformanceRepo: Repository<DcStudentsPerformance>,
    @InjectRepository(DcStudentPerformance)
    private dcStudentPerformanceRepo: Repository<DcStudentPerformance>,
    @InjectRepository(DcActivityParticipation)
    private dcActivityParticipationRepo: Repository<DcActivityParticipation>,
    @InjectRepository(DcEventParticipation)
    private dcEventParticipationRepo: Repository<DcEventParticipation>,
    @InjectRepository(DcFeeStructure)
    private dcFeeStructureRepo: Repository<DcFeeStructure>,
    @InjectRepository(DcInfrastructure)
    private dcInfrastructureRepo: Repository<DcInfrastructure>,
    @InjectRepository(DcStudentsInfo)
    private dcStudentsInfoRepo: Repository<DcStudentsInfo>,
    @InjectRepository(DcTeachersDevelopment)
    private dcTeachersDevelopmentRepo: Repository<DcTeachersDevelopment>,
    @InjectRepository(DcRevenueBudgetTotal)
    private dcRevenueBudgetTotalRepo: Repository<DcRevenueBudgetTotal>,
    @InjectRepository(DcRevenueBudgetMonthly)
    private dcRevenueBudgetMonthlyRepo: Repository<DcRevenueBudgetMonthly>,
    @InjectRepository(DcRevenueActualTotal)
    private dcRevenueActualTotalRepo: Repository<DcRevenueActualTotal>,
    @InjectRepository(DcRevenueActualMonthly)
    private dcRevenueActualMonthlyRepo: Repository<DcRevenueActualMonthly>,
    @InjectRepository(DcSchool)
    private dcSchoolsRepo: Repository<DcSchool>,
  ) {}

  /**
   * Resolve DcSchool names for DC rows in one batched query — the recycle bin
   * lists every deleted item, so per-row joins would be wasteful.
   */
  private async resolveSchoolNames<T extends { schoolId: string }>(
    records: T[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(records.map((r) => r.schoolId))];
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const schools = await this.dcSchoolsRepo.find({
      withDeleted: true,
      where: { id: In(ids) },
      select: ['id', 'name'],
    });
    for (const s of schools) map.set(s.id, s.name);
    return map;
  }

  async findAllDeleted() {
    const [
      surveys,
      users,
      categories,
      schoolRecords,
      schools,
      geoLocations,
      teacherIndividuals,
      alumni,
      pedagogicalAchievements,
      cocurriculars,
      studentsPerformances,
      studentPerformances,
      activityParticipations,
      eventParticipations,
      feeStructures,
      infrastructures,
      studentsInfos,
      teachersDevelopments,
      revenueBudgetTotals,
      revenueBudgetMonthlies,
      revenueActualTotals,
      revenueActualMonthlies,
    ] = await Promise.all([
        this.surveysRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'title', 'category', 'status', 'deletedAt', 'createdAt'],
        }),
        this.usersRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'firstName', 'lastName', 'email', 'deletedAt', 'createdAt'],
        }),
        this.categoriesRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
        }),
        this.schoolRecordsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'deletedAt', 'createdAt'],
        }),
        this.schoolsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'code', 'deletedAt', 'createdAt'],
        }),
        this.geoLocationsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'type', 'deletedAt', 'createdAt'],
        }),
        this.dcTeacherIndividualsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'name', 'designation', 'deletedAt', 'createdAt'],
        }),
        this.dcAlumniRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'alumniName', 'graduationYear', 'deletedAt', 'createdAt'],
        }),
        this.dcPedagogicalAchievementsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'year', 'kgScholarship', 'primaryScholarship', 'jrScholarship', 'sscScholarship', 'othersScholarship', 'deletedAt', 'createdAt'],
        }),
        this.dcCocurricularRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'grade', 'deletedAt', 'createdAt'],
        }),
        this.dcStudentsPerformanceRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'grade', 'examName', 'numberOfStudents', 'deletedAt', 'createdAt'],
        }),
        this.dcStudentPerformanceRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'formKey', 'grade', 'evaluationPeriod', 'numberOfStudents', 'appearedPercent', 'deletedAt', 'createdAt'],
        }),
        this.dcActivityParticipationRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'item', 'year', 'month', 'grade', 'activityName', 'conductedCount', 'participationRate', 'deletedAt', 'createdAt'],
        }),
        this.dcEventParticipationRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'eventName', 'awardLevel', 'totalAwarded', 'deletedAt', 'createdAt'],
        }),
        this.dcFeeStructureRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'grade', 'admissionFee', 'tuitionFee', 'sessionFee', 'assessmentFee', 'sportsFee', 'syllabusFee', 'admissionForm', 'testimonialFee', 'othersFee', 'transportFee', 'deletedAt', 'createdAt'],
        }),
        this.dcInfrastructureRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'campusStatus', 'roomTotal', 'deletedAt', 'createdAt'],
        }),
        this.dcStudentsInfoRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'grade', 'total', 'deletedAt', 'createdAt'],
        }),
        this.dcTeachersDevelopmentRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'deletedAt', 'createdAt'],
        }),
        this.dcRevenueBudgetTotalRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'deletedAt', 'createdAt'],
        }),
        this.dcRevenueBudgetMonthlyRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'collectionPct', 'deletedAt', 'createdAt'],
        }),
        this.dcRevenueActualTotalRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'deletedAt', 'createdAt'],
        }),
        this.dcRevenueActualMonthlyRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'schoolId', 'academicYear', 'month', 'collectionPct', 'deletedAt', 'createdAt'],
        }),
      ]);

    // Batch-resolve school names for all DC record types.
    const schoolNames = new Map<string, string>();
    const dcGroups: { schoolId: string }[][] = [teacherIndividuals, alumni, pedagogicalAchievements, cocurriculars, studentsPerformances, studentPerformances, activityParticipations, eventParticipations, feeStructures, infrastructures, studentsInfos, teachersDevelopments, revenueBudgetTotals, revenueBudgetMonthlies, revenueActualTotals, revenueActualMonthlies];
    for (const group of dcGroups) {
      for (const [id, name] of await this.resolveSchoolNames(group)) {
        schoolNames.set(id, name);
      }
    }

    return {
      surveys: surveys.map((s) => ({
        ...s,
        entityType: 'survey' as const,
        displayName: s.title,
      })),
      users: users.map((u) => ({
        ...u,
        entityType: 'user' as const,
        displayName: `${u.firstName} ${u.lastName}`,
      })),
      categories: categories.map((c) => ({
        ...c,
        entityType: 'category' as const,
        displayName: c.name,
      })),
      schoolRecords: schoolRecords.map((sr) => ({
        ...sr,
        entityType: 'school-record' as const,
        displayName: sr.name,
      })),
      schools: schools.map((s) => ({
        ...s,
        entityType: 'school' as const,
        displayName: s.name,
      })),
      geoLocations: geoLocations.map((g) => ({
        ...g,
        entityType: 'geo-location' as const,
        displayName: g.name,
      })),
      teacherIndividuals: teacherIndividuals.map((t) => ({
        ...t,
        entityType: 'dc-teacher-individual' as const,
        schoolName: schoolNames.get(t.schoolId),
        displayName: `${t.name} (${t.academicYear})`,
      })),
      dcAlumni: alumni.map((a) => ({
        ...a,
        entityType: 'dc-alumni' as const,
        schoolName: schoolNames.get(a.schoolId),
        displayName: a.alumniName,
      })),
      dcPedagogicalAchievements: pedagogicalAchievements.map((p) => ({
        ...p,
        entityType: 'dc-pedagogical-achievement' as const,
        schoolName: schoolNames.get(p.schoolId),
        displayName: `Scholarship/Achievement ${p.year}`,
      })),
      dcCocurricular: cocurriculars.map((c) => ({
        ...c,
        entityType: 'dc-cocurricular' as const,
        schoolName: schoolNames.get(c.schoolId),
        displayName: `${c.grade} — ${c.month} ${c.academicYear}`,
      })),
      dcStudentsPerformances: studentsPerformances.map((sp) => ({
        ...sp,
        entityType: 'dc-students-performance' as const,
        schoolName: schoolNames.get(sp.schoolId),
        displayName: `${sp.grade} — ${sp.examName} ${sp.academicYear}`,
      })),
      dcStudentPerformances: studentPerformances.map((sp) => ({
        ...sp,
        entityType: 'dc-student-performance' as const,
        schoolName: schoolNames.get(sp.schoolId),
        displayName: `${sp.formKey.toUpperCase()} — ${sp.grade} (${sp.evaluationPeriod} ${sp.academicYear})`,
      })),
      dcActivityParticipations: activityParticipations.map((ap) => ({
        ...ap,
        entityType: 'dc-activity-participation' as const,
        schoolName: schoolNames.get(ap.schoolId),
        displayName: `${ap.item} — ${ap.grade}, ${ap.month} ${ap.year}`,
      })),
      dcEventParticipations: eventParticipations.map((ep) => ({
        ...ep,
        entityType: 'dc-event-participation' as const,
        schoolName: schoolNames.get(ep.schoolId),
        displayName: ep.eventName,
      })),
      dcFeeStructures: feeStructures.map((f) => ({
        ...f,
        entityType: 'dc-fee-structure' as const,
        schoolName: schoolNames.get(f.schoolId),
        displayName: `${f.grade} — ${f.month} ${f.academicYear}`,
      })),
      dcInfrastructures: infrastructures.map((i) => ({
        ...i,
        entityType: 'dc-infrastructure' as const,
        schoolName: schoolNames.get(i.schoolId),
        displayName: `Infrastructure & Classroom — ${i.academicYear}`,
      })),
      dcStudentsInfos: studentsInfos.map((si) => ({
        ...si,
        entityType: 'dc-students-info' as const,
        schoolName: schoolNames.get(si.schoolId),
        displayName: `${si.grade} — ${si.month} ${si.academicYear}`,
      })),
      dcTeachersDevelopments: teachersDevelopments.map((td) => ({
        ...td,
        entityType: 'dc-teachers-development' as const,
        schoolName: schoolNames.get(td.schoolId),
        displayName: `${td.month} ${td.academicYear}`,
      })),
      dcRevenueBudgetTotals: revenueBudgetTotals.map((r) => ({
        ...r,
        entityType: 'dc-revenue-budget-total' as const,
        schoolName: schoolNames.get(r.schoolId),
        displayName: `Planned Revenue (Total) — ${r.academicYear}`,
      })),
      dcRevenueBudgetMonthlies: revenueBudgetMonthlies.map((r) => ({
        ...r,
        entityType: 'dc-revenue-budget-monthly' as const,
        schoolName: schoolNames.get(r.schoolId),
        displayName: `Planned Revenue — ${r.month} ${r.academicYear}`,
      })),
      dcRevenueActualTotals: revenueActualTotals.map((r) => ({
        ...r,
        entityType: 'dc-revenue-actual-total' as const,
        schoolName: schoolNames.get(r.schoolId),
        displayName: `Actual Revenue (Total) — ${r.academicYear}`,
      })),
      dcRevenueActualMonthlies: revenueActualMonthlies.map((r) => ({
        ...r,
        entityType: 'dc-revenue-actual-monthly' as const,
        schoolName: schoolNames.get(r.schoolId),
        displayName: `Actual Revenue — ${r.month} ${r.academicYear}`,
      })),
    };
  }

  async restore(entityType: RecycleBinEntityType, id: string, actorId?: string) {
    const repo = this.getRepository(entityType);
    const entity = await repo.findOne({
      withDeleted: true,
      where: { id } as any,
    });
    if (!entity || !(entity as any).deletedAt) {
      throw new NotFoundException('Deleted item not found');
    }
    // Restoring a soft-deleted account resurrects it — same takeover risk as
    // editing a live user, so the privilege-hierarchy rule applies.
    if (entityType === 'user') {
      await this.assertCanManageDeletedUser(id, actorId);
    }
    (entity as any).deletedAt = null;
    await repo.save(entity as any);
    return { message: `${entityType} restored successfully` };
  }

  async permanentDelete(entityType: RecycleBinEntityType, id: string, actorId?: string) {
    const repo = this.getRepository(entityType);
    const entity = await repo.findOne({
      withDeleted: true,
      where: { id } as any,
    });
    if (!entity || !(entity as any).deletedAt) {
      throw new NotFoundException(
        'Item not found in recycle bin. Only soft-deleted items can be permanently removed.',
      );
    }
    if (entityType === 'user') {
      await this.assertCanManageDeletedUser(id, actorId);
    }
    await repo.remove(entity as any);
    return { message: `${entityType} permanently deleted` };
  }

  /**
   * Restoring/hard-deleting soft-deleted users bypasses every live-user
   * hierarchy guard, so enforce the same rule here: a non-Super-Admin may
   * only manage deleted users whose strongest role is weaker than their own.
   */
  private async assertCanManageDeletedUser(
    targetUserId: string,
    actorId?: string,
  ): Promise<void> {
    if (!actorId) return; // internal/system callers (seeding, scripts)
    const [actor, target] = await Promise.all([
      this.usersRepo.findOne({
        where: { id: actorId },
        relations: ['roles'],
      }),
      this.usersRepo.findOne({
        withDeleted: true,
        where: { id: targetUserId },
        relations: ['roles'],
      }),
    ]);
    const isSuperAdmin = (actor?.roles || []).some(
      (r) => r.name === 'Super Admin',
    );
    if (!actor || isSuperAdmin) return;
    const bestOf = (roles?: any[] | null) =>
      Math.min(
        ...(roles || []).map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY,
      );
    if (bestOf(target?.roles) < bestOf(actor.roles)) {
      throw new ForbiddenException(
        'You cannot restore or permanently delete users who have more privileges than you',
      );
    }
  }

  private getRepository(
    entityType: RecycleBinEntityType,
  ): Repository<any> {
    switch (entityType) {
      case 'survey':
        return this.surveysRepo;
      case 'user':
        return this.usersRepo;
      case 'category':
        return this.categoriesRepo;
      case 'school-record':
        return this.schoolRecordsRepo;
      case 'school':
        return this.schoolsRepo;
      case 'geo-location':
        return this.geoLocationsRepo;
      case 'dc-teacher-individual':
        return this.dcTeacherIndividualsRepo;
      case 'dc-alumni':
        return this.dcAlumniRepo;
      case 'dc-pedagogical-achievement':
        return this.dcPedagogicalAchievementsRepo;
      case 'dc-cocurricular':
        return this.dcCocurricularRepo;
      case 'dc-students-performance':
        return this.dcStudentsPerformanceRepo;
      case 'dc-student-performance':
        return this.dcStudentPerformanceRepo;
      case 'dc-activity-participation':
        return this.dcActivityParticipationRepo;
      case 'dc-event-participation':
        return this.dcEventParticipationRepo;
      case 'dc-fee-structure':
        return this.dcFeeStructureRepo;
      case 'dc-infrastructure':
        return this.dcInfrastructureRepo;
      case 'dc-students-info':
        return this.dcStudentsInfoRepo;
      case 'dc-teachers-development':
        return this.dcTeachersDevelopmentRepo;
      case 'dc-revenue-budget-total':
        return this.dcRevenueBudgetTotalRepo;
      case 'dc-revenue-budget-monthly':
        return this.dcRevenueBudgetMonthlyRepo;
      case 'dc-revenue-actual-total':
        return this.dcRevenueActualTotalRepo;
      case 'dc-revenue-actual-monthly':
        return this.dcRevenueActualMonthlyRepo;
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }
}
