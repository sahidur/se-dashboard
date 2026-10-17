import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
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

  // ===================== Tenant scoping =====================

  private isAdminRole(roles?: string[]): boolean {
    return !!roles?.includes('Super Admin') || !!roles?.includes('Admin');
  }

  /**
   * Schools (dc_schools registry) a non-admin user may manage: ones they
   * created plus ones assigned to them via Users > Assign Schools. Mirrors
   * the rules used by DataCollectionService.validateSchoolAccess and
   * SchoolScopeGuard.
   */
  private async accessibleSchoolIds(userId: string): Promise<string[]> {
    const [user, created] = await Promise.all([
      this.usersRepo.findOne({
        where: { id: userId },
        relations: ['schools'],
      }),
      this.dcSchoolsRepo.find({
        where: { createdById: userId },
        select: ['id'],
      }),
    ]);
    return [
      ...new Set([
        ...(user?.schools || []).map((s) => s.id),
        ...created.map((s) => s.id),
      ]),
    ];
  }

  /**
   * List every soft-deleted item the calling actor may manage. Admin-tier
   * roles see all tenants; anyone else is scoped to their own created/assigned
   * schools and their own surveys/records, so a leaked or over-granted
   * `recycle-bin:read` permission cannot dump other tenants' deleted data
   * (including other users' email addresses). Global reference data (deleted
   * users, survey categories, geo-locations) is admin-only, since it has no
   * tenant linkage that could be filtered on.
   */
  async findAllDeleted(actorId: string, roles: string[]) {
    const isAdmin = this.isAdminRole(roles);
    const accessible = isAdmin ? null : await this.accessibleSchoolIds(actorId);
    const hasSchools = isAdmin || (accessible?.length ?? 0) > 0;

    /** DC rows: every school the actor manages (null group = skip query). */
    const dcWhere = (): Record<string, unknown> | null =>
      isAdmin
        ? { deletedAt: Not(IsNull()) }
        : hasSchools
          ? { deletedAt: Not(IsNull()), schoolId: In(accessible!) }
          : null;

    /** Created-by-me items (surveys, school records). */
    const createdByMe = (): Record<string, unknown> | null =>
      isAdmin
        ? { deletedAt: Not(IsNull()) }
        : { deletedAt: Not(IsNull()), createdById: actorId };

    /** Items with no tenant linkage — admin-tier only. */
    const adminOnly = (): Record<string, unknown> | null =>
      isAdmin ? { deletedAt: Not(IsNull()) } : null;

    const run = async (
      repo: Repository<any>,
      where: Record<string, unknown> | null,
      select?: string[],
    ): Promise<any[]> =>
      where
        ? repo.find({ withDeleted: true, where: where as any, select })
        : [];

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
      run(this.surveysRepo, createdByMe(), [
        'id', 'title', 'category', 'status', 'deletedAt', 'createdAt',
      ]),
      run(this.usersRepo, adminOnly(), [
        'id', 'firstName', 'lastName', 'email', 'deletedAt', 'createdAt',
      ]),
      run(this.categoriesRepo, adminOnly()),
      run(this.schoolRecordsRepo, createdByMe(), [
        'id', 'name', 'deletedAt', 'createdAt',
      ]),
      // School rows (students-module registry) carry no tenant linkage —
      // admin-tier only, like categories/geo-locations.
      run(this.schoolsRepo, adminOnly(), [
        'id', 'name', 'code', 'deletedAt', 'createdAt',
      ]),
      run(this.geoLocationsRepo, adminOnly(), [
        'id', 'name', 'type', 'deletedAt', 'createdAt',
      ]),
      run(this.dcTeacherIndividualsRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'name', 'designation', 'deletedAt', 'createdAt',
      ]),
      run(this.dcAlumniRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'alumniName', 'graduationYear', 'deletedAt', 'createdAt',
      ]),
      run(this.dcPedagogicalAchievementsRepo, dcWhere(), [
        'id', 'schoolId', 'year', 'kgScholarship', 'primaryScholarship', 'jrScholarship', 'sscScholarship', 'othersScholarship', 'deletedAt', 'createdAt',
      ]),
      run(this.dcCocurricularRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'grade', 'deletedAt', 'createdAt',
      ]),
      run(this.dcStudentsPerformanceRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'grade', 'examName', 'numberOfStudents', 'deletedAt', 'createdAt',
      ]),
      run(this.dcStudentPerformanceRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'formKey', 'grade', 'evaluationPeriod', 'numberOfStudents', 'appearedPercent', 'deletedAt', 'createdAt',
      ]),
      run(this.dcActivityParticipationRepo, dcWhere(), [
        'id', 'schoolId', 'item', 'year', 'month', 'grade', 'activityName', 'conductedCount', 'participationRate', 'deletedAt', 'createdAt',
      ]),
      run(this.dcEventParticipationRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'eventName', 'awardLevel', 'totalAwarded', 'deletedAt', 'createdAt',
      ]),
      run(this.dcFeeStructureRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'grade', 'admissionFee', 'tuitionFee', 'sessionFee', 'assessmentFee', 'sportsFee', 'syllabusFee', 'admissionForm', 'testimonialFee', 'othersFee', 'transportFee', 'deletedAt', 'createdAt',
      ]),
      run(this.dcInfrastructureRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'campusStatus', 'roomTotal', 'deletedAt', 'createdAt',
      ]),
      run(this.dcStudentsInfoRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'grade', 'total', 'deletedAt', 'createdAt',
      ]),
      run(this.dcTeachersDevelopmentRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'deletedAt', 'createdAt',
      ]),
      run(this.dcRevenueBudgetTotalRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'deletedAt', 'createdAt',
      ]),
      run(this.dcRevenueBudgetMonthlyRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'collectionPct', 'deletedAt', 'createdAt',
      ]),
      run(this.dcRevenueActualTotalRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'deletedAt', 'createdAt',
      ]),
      run(this.dcRevenueActualMonthlyRepo, dcWhere(), [
        'id', 'schoolId', 'academicYear', 'month', 'collectionPct', 'deletedAt', 'createdAt',
      ]),
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

  async restore(
    entityType: RecycleBinEntityType,
    id: string,
    actorId: string,
    roles: string[],
  ) {
    const repo = this.getRepository(entityType);
    const entity = await repo.findOne({
      withDeleted: true,
      where: { id } as any,
    });
    if (!entity || !(entity as any).deletedAt) {
      throw new NotFoundException('Deleted item not found');
    }
    // Restore only items the actor may manage — a raw UUID lookup must not
    // resurrect another tenant's deleted data (or a user above the actor's
    // privilege level).
    await this.assertCanManageRecycleBinItem(entityType, entity, actorId, roles);
    (entity as any).deletedAt = null;
    // If a live record was re-created for the same key after the delete,
    // the unique index rejects the restore — report a clear 409 instead of
    // bubbling the driver error as a 500.
    try {
      await repo.save(entity as any);
    } catch (error) {
      const err = error as { code?: string; driverError?: { code?: string } };
      if ((err.driverError?.code ?? err.code) === '23505') {
        throw new ConflictException(
          'A live record with the same details already exists — delete it first or keep it instead of restoring',
        );
      }
      throw error;
    }
    return { message: `${entityType} restored successfully` };
  }

  /**
   * Every many-to-one column in the schema that references users and is
   * nullable — the references that can be cleared before a hard delete.
   * Derived from entity metadata (audit_logs.user_id, students.created_by_id,
   * DC/fee created_by_id…) so new tables are covered automatically; NOT NULL
   * columns (surveys.created_by, payments.collected_by_id, receipts.
   * issued_by_id…) are deliberately left to block the delete with a clear
   * message instead of being silently rewritten.
   */
  private nullableUserForeignKeyColumns(): { tablePath: string; column: string }[] {
    const columns: { tablePath: string; column: string }[] = [];
    for (const meta of this.dataSource.entityMetadatas) {
      for (const rel of meta.relations) {
        if (rel.relationType !== 'many-to-one') continue;
        if (rel.inverseEntityMetadata.target !== User) continue;
        const col = rel.joinColumns[0];
        if (!col || !col.isNullable) continue;
        columns.push({ tablePath: meta.tablePath, column: col.databaseName });
      }
    }
    return columns;
  }

  async permanentDelete(
    entityType: RecycleBinEntityType,
    id: string,
    actorId: string,
    roles: string[],
  ) {
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
    // Hard-deleting another tenant's soft-deleted rows (fee structures,
    // revenue records, schools…) is as destructive as restoring them — apply
    // the same per-entity manage guard.
    await this.assertCanManageRecycleBinItem(entityType, entity, actorId, roles);

    // Atomic: either the row is fully removed, or nothing changes.
    await this.dataSource.transaction(async (manager) => {
      if (entityType === 'user') {
        // A hard DELETE of a user is rejected by every table referencing them
        // (audit logs, created data, collected payments…), which surfaced as a
        // 500. Nullable references are cleared first so users without
        // hard-linked data can be fully removed — history rows survive with
        // unknown attribution.
        for (const { tablePath, column } of this.nullableUserForeignKeyColumns()) {
          await manager.query(
            `UPDATE ${tablePath} SET ${column} = NULL WHERE ${column} = $1`,
            [id],
          );
        }
      }
      try {
        await manager.remove(repo.target as any, entity as any);
      } catch (error) {
        const err = error as { code?: string; driverError?: { code?: string } };
        if ((err.driverError?.code ?? err.code) === '23503') {
          throw new ConflictException(
            entityType === 'user'
              ? 'This user still has records that keep them — e.g. surveys, schools or form data they created, payments they collected, or receipts they issued. Users with such data cannot be permanently deleted; deactivate the user instead or keep them in the recycle bin.'
              : 'This item is still referenced by other records and cannot be permanently deleted.',
          );
        }
        throw error;
      }
    });
    return { message: `${entityType} permanently deleted` };
  }

  /**
   * Per-entity ownership/tenant guard for restore and permanent delete.
   * Admin-tier roles manage everything. Everyone else:
   *  - user        → privilege-hierarchy rule (assertCanManageDeletedUser)
   *  - survey /
   *    school-record → own records only
   *  - dc-*        → rows belonging to schools they manage
   *  - school /
   *    category /
   *    geo-location → no tenant linkage (global registries) → admins only
   * Denials throw the same 404 as a missing item so probing other tenants'
   * UUIDs does not disclose which soft-deleted rows exist.
   */
  private async assertCanManageRecycleBinItem(
    entityType: RecycleBinEntityType,
    entity: any,
    actorId: string,
    roles: string[],
  ): Promise<void> {
    if (entityType === 'user') {
      // Hierarchy guard applies even to plain Admins (a non-Super-Admin must
      // never restore or permanently delete a Super Admin or peer Admin).
      await this.assertCanManageDeletedUser(entity.id, actorId);
      return;
    }
    if (this.isAdminRole(roles)) return;
    if (entityType === 'survey' || entityType === 'school-record') {
      if (entity.createdById !== actorId) {
        throw new NotFoundException('Deleted item not found');
      }
      return;
    }
    if (entityType.startsWith('dc-')) {
      const accessible = await this.accessibleSchoolIds(actorId);
      if (accessible.includes(entity.schoolId)) return;
      throw new NotFoundException('Deleted item not found');
    }
    // 'school', 'category' and 'geo-location': no tenant linkage → admins only.
    throw new NotFoundException('Deleted item not found');
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
    if (!actorId) throw new ForbiddenException('Actor is required to manage deleted users');
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
    if (!actor) throw new ForbiddenException('Actor not found');
    if (isSuperAdmin) return;
    const bestOf = (roles?: any[] | null) =>
      Math.min(
        ...(roles || []).map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY,
      );
    if (!target || bestOf(target.roles) <= bestOf(actor.roles)) {
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
