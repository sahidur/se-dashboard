import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { DcSchool } from './entities/dc-school.entity';
import { DcBasicInfo } from './entities/dc-basic-info.entity';
import { DcInfrastructure } from './entities/dc-infrastructure.entity';
import { DcStudentsInfo } from './entities/dc-students-info.entity';
import { DcTeachersInfo } from './entities/dc-teachers-info.entity';
import { DcTeacherIndividual } from './entities/dc-teacher-individual.entity';
import { DcTeachersDevelopment } from './entities/dc-teachers-development.entity';
import { DcRevenue } from './entities/dc-revenue.entity';
import { DcFeeStructure } from './entities/dc-fee-structure.entity';
import { DcFeeStructureLog } from './entities/dc-fee-structure-log.entity';
import { DcRevenueBudgetTotal } from './entities/dc-revenue-budget-total.entity';
import { DcRevenueBudgetMonthly } from './entities/dc-revenue-budget-monthly.entity';
import { DcRevenueActualTotal } from './entities/dc-revenue-actual-total.entity';
import { DcRevenueActualMonthly } from './entities/dc-revenue-actual-monthly.entity';
import { DcPerformance } from './entities/dc-performance.entity';
import { DcAlumni } from './entities/dc-alumni.entity';
import { DcPedagogicalAchievement } from './entities/dc-pedagogical-achievement.entity';
import { DcCocurricular } from './entities/dc-cocurricular.entity';
import { DcStudentsPerformance } from './entities/dc-students-performance.entity';
import { DcStudentPerformance } from './entities/dc-student-performance.entity';
import { DcActivityParticipation } from './entities/dc-activity-participation.entity';
import { DcEventParticipation } from './entities/dc-event-participation.entity';
import { DcFormDraft } from './entities/dc-form-draft.entity';
import {
  CreateDcSchoolDto,
  UpdateDcSchoolDto,
  UpsertBasicInfoDto,
  UpsertInfrastructureDto,
  UpsertStudentsInfoDto,
  UpsertTeachersInfoDto,
  CreateTeacherIndividualDto,
  UpsertTeachersDevelopmentDto,
  UpsertRevenueDto,
  UpsertFeeStructureDto,
  UpsertRevenueBudgetTotalDto,
  UpsertRevenueBudgetMonthlyDto,
  UpsertRevenueActualTotalDto,
  UpsertRevenueActualMonthlyDto,
  UpsertPerformanceDto,
  CreateAlumniDto,
  UpdateAlumniDto,
  UpdateTeacherIndividualDto,
  UpsertPedagogicalAchievementDto,
  UpsertCocurricularDto,
  UpsertStudentsPerformanceDto,
  UpsertStudentPerformanceDto,
  UpsertActivityParticipationDto,
  CreateEventParticipationDto,
  UpdateEventParticipationDto,
  UpsertFormDraftDto,
} from './dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class DataCollectionService {
  constructor(
    @InjectRepository(DcSchool) private schoolRepo: Repository<DcSchool>,
    @InjectRepository(DcBasicInfo) private basicInfoRepo: Repository<DcBasicInfo>,
    @InjectRepository(DcInfrastructure) private infraRepo: Repository<DcInfrastructure>,
    @InjectRepository(DcStudentsInfo) private studentsRepo: Repository<DcStudentsInfo>,
    @InjectRepository(DcTeachersInfo) private teachersRepo: Repository<DcTeachersInfo>,
    @InjectRepository(DcTeacherIndividual) private teacherIndividualRepo: Repository<DcTeacherIndividual>,
    @InjectRepository(DcTeachersDevelopment) private teachersDevRepo: Repository<DcTeachersDevelopment>,
    @InjectRepository(DcRevenue) private revenueRepo: Repository<DcRevenue>,
    @InjectRepository(DcFeeStructure) private feeStructureRepo: Repository<DcFeeStructure>,
    @InjectRepository(DcFeeStructureLog) private feeStructureLogRepo: Repository<DcFeeStructureLog>,
    @InjectRepository(DcRevenueBudgetTotal) private revBudgetTotalRepo: Repository<DcRevenueBudgetTotal>,
    @InjectRepository(DcRevenueBudgetMonthly) private revBudgetMonthlyRepo: Repository<DcRevenueBudgetMonthly>,
    @InjectRepository(DcRevenueActualTotal) private revActualTotalRepo: Repository<DcRevenueActualTotal>,
    @InjectRepository(DcRevenueActualMonthly) private revActualMonthlyRepo: Repository<DcRevenueActualMonthly>,
    @InjectRepository(DcPerformance) private performanceRepo: Repository<DcPerformance>,
    @InjectRepository(DcAlumni) private alumniRepo: Repository<DcAlumni>,
    @InjectRepository(DcPedagogicalAchievement) private pedagAchievRepo: Repository<DcPedagogicalAchievement>,
    @InjectRepository(DcCocurricular) private cocurricularRepo: Repository<DcCocurricular>,
    @InjectRepository(DcStudentsPerformance) private studentsPerfRepo: Repository<DcStudentsPerformance>,
    @InjectRepository(DcStudentPerformance) private studentPerfRepo: Repository<DcStudentPerformance>,
    @InjectRepository(DcActivityParticipation) private activityPartRepo: Repository<DcActivityParticipation>,
    @InjectRepository(DcFormDraft) private formDraftRepo: Repository<DcFormDraft>,
    @InjectRepository(DcEventParticipation) private eventPartRepo: Repository<DcEventParticipation>,
    private usersService: UsersService,
  ) {}

  // ===================== Helper =====================

  private isAdminRole(roles: string[]): boolean {
    return roles.includes('Super Admin') || roles.includes('Admin');
  }

  /** School IDs explicitly assigned to a user via Users > Assign Schools (in addition to ones they created). */
  private async getAssignedSchoolIds(userId: string): Promise<string[]> {
    const assigned = await this.usersService.getSchools(userId);
    return assigned.map((s) => s.id);
  }

  private async validateSchoolAccess(schoolId: string, userId: string, roles: string[]): Promise<DcSchool> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException('School not found or access denied');
    }
    if (this.isAdminRole(roles) || school.createdById === userId) {
      return school;
    }
    const assignedIds = await this.getAssignedSchoolIds(userId);
    if (assignedIds.includes(schoolId)) {
      return school;
    }
    throw new NotFoundException('School not found or access denied');
  }

  /**
   * Whether the user is allowed to overwrite/edit data that has already been
   * submitted for a form. Super Admin/Admin always can (matches their
   * existing full-access bypass elsewhere in this service); any other role
   * needs the dedicated `data-collection-edit:update` permission, granted
   * per-role in Role Management. Roles WITHOUT it can still create brand-new
   * records (governed by the normal `data-collection:create` permission) —
   * they just can't modify a record that already exists.
   */
  private async canEditSubmittedData(userId: string, roles: string[]): Promise<boolean> {
    if (this.isAdminRole(roles)) return true;
    const fullUser = await this.usersService.findOneById(userId);
    const permissions = fullUser?.roles?.flatMap((r) => r.permissions || []) ?? [];
    return permissions.some(
      (p) => p.module === 'data-collection-edit' && p.action === 'update',
    );
  }

  /** Throws 403 if `existing` is true (i.e. this call would overwrite a previously-submitted record) and the user lacks edit-submitted-data permission. */
  private async assertCanEditExisting(existing: boolean, userId: string, roles: string[]): Promise<void> {
    if (!existing) return;
    const allowed = await this.canEditSubmittedData(userId, roles);
    if (!allowed) {
      throw new ForbiddenException(
        'This data has already been submitted. You do not have permission to edit submitted data — ask an administrator to grant "Edit Submitted Data" in Role Management.',
      );
    }
  }

  /**
   * Chronological ordering for the month-keyed forms. `month` is stored as a
   * full month NAME (varchar), so a SQL `ORDER BY month ASC` sorts it
   * alphabetically (April, August, December…) instead of chronologically —
   * these tables must be sorted in JS. Newest academic year first.
   */
  private compareYearThenMonth(
    a: { academicYear: number; month: string },
    b: { academicYear: number; month: string },
  ): number {
    const yDiff = Number(b.academicYear ?? 0) - Number(a.academicYear ?? 0);
    if (yDiff !== 0) return yDiff;
    const order = DataCollectionService.MONTH_ORDER;
    return order.indexOf(a.month) - order.indexOf(b.month);
  }

  // ===================== School CRUD =====================

  async createSchool(dto: CreateDcSchoolDto, userId: string): Promise<DcSchool> {
    // Auto-generate code if not provided
    const code = dto.code || `SCH-${Date.now().toString(36).toUpperCase()}`;
    const existing = await this.schoolRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`School code "${code}" already exists`);
    }
    const school = this.schoolRepo.create({ ...dto, code, createdById: userId });
    return this.schoolRepo.save(school);
  }

  async findAllSchools(userId: string, roles: string[], search?: string): Promise<DcSchool[]> {
    const admin = this.isAdminRole(roles);
    const relations = { createdBy: true };

    let baseWhere: any[] = [];
    if (!admin) {
      const assignedIds = await this.getAssignedSchoolIds(userId);
      baseWhere = assignedIds.length
        ? [{ createdById: userId }, { id: In(assignedIds) }]
        : [{ createdById: userId }];
    }

    if (search) {
      const searchClauses = admin
        ? [{ name: ILike(`%${search}%`) }, { code: ILike(`%${search}%`) }]
        : baseWhere.flatMap((w) => [
            { ...w, name: ILike(`%${search}%`) },
            { ...w, code: ILike(`%${search}%`) },
          ]);
      return this.schoolRepo.find({
        where: searchClauses,
        relations,
        order: { createdAt: 'DESC' },
      });
    }

    return this.schoolRepo.find({
      where: admin ? {} : baseWhere,
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneSchool(id: string, userId: string, roles: string[]): Promise<DcSchool> {
    return this.validateSchoolAccess(id, userId, roles);
  }

  async updateSchool(id: string, dto: UpdateDcSchoolDto, userId: string, roles: string[]): Promise<DcSchool> {
    const school = await this.validateSchoolAccess(id, userId, roles);
    Object.assign(school, dto);
    return this.schoolRepo.save(school);
  }

  async deleteSchool(id: string, userId: string, roles: string[]): Promise<void> {
    const school = await this.validateSchoolAccess(id, userId, roles);
    await this.schoolRepo.softRemove(school);
  }

  // ===================== Dashboard =====================

  async getDashboard(schoolId: string, userId: string, roles: string[]) {
    const school = await this.validateSchoolAccess(schoolId, userId, roles);
    const [basicInfo, infra, studentsCount, teacherIndividualCount, teachersDevCount, revenue, feeStructureCount, revBudgetTotal, revBudgetMonthlyCount, revActualTotal, revActualMonthlyCount, performance, alumni, pedagAchievCount, cocurricularCount, studentsPerfCount, studentPerfCount, activityPartCount, eventPartCount] =
      await Promise.all([
        this.basicInfoRepo.findOne({ where: { schoolId }, order: { academicYear: 'DESC' } }),
        this.infraRepo.findOne({ where: { schoolId }, order: { academicYear: 'DESC' } }),
        this.studentsRepo.count({ where: { schoolId } }),
        this.teacherIndividualRepo.count({ where: { schoolId } }),
        this.teachersDevRepo.count({ where: { schoolId } }),
        this.revenueRepo.findOne({ where: { schoolId }, order: { academicYear: 'DESC' } }),
        this.feeStructureRepo.count({ where: { schoolId } }),
        this.revBudgetTotalRepo.findOne({ where: { schoolId }, order: { academicYear: 'DESC' } }),
        this.revBudgetMonthlyRepo.count({ where: { schoolId } }),
        this.revActualTotalRepo.findOne({ where: { schoolId } , order: { academicYear: 'DESC' } }),
        this.revActualMonthlyRepo.count({ where: { schoolId } }),
        this.performanceRepo.findOne({ where: { schoolId }, order: { academicYear: 'DESC' } }),
        this.alumniRepo.find({ where: { schoolId } }),
        this.pedagAchievRepo.count({ where: { schoolId } }),
        this.cocurricularRepo.count({ where: { schoolId } }),
        this.studentsPerfRepo.count({ where: { schoolId } }),
        this.studentPerfRepo.count({ where: { schoolId } }),
        this.activityPartRepo.count({ where: { schoolId } }),
        this.eventPartRepo.count({ where: { schoolId } }),
      ]);

    // Infrastructure Status: submitted when campus or building data exists
    const infraSubmitted = !!(infra && (infra.campusStatus || infra.buildingStatus));
    // Classroom Status: submitted when classroom-specific boolean fields are filled
    const classroomSubmitted = !!(
      infra &&
      (infra.classroomNewFurniture !== null || infra.classroomRenovationRequired !== null)
    );

    return {
      school,
      forms: {
        basicInformation: { submitted: !!basicInfo, data: basicInfo },
        infrastructure: { submitted: infraSubmitted, data: infra },
        classroomStatus: { submitted: classroomSubmitted },
        studentsInfo: { submitted: studentsCount > 0, count: studentsCount },
        teachersInfo: { submitted: teacherIndividualCount > 0, count: teacherIndividualCount },
        teachersDev: { submitted: teachersDevCount > 0, count: teachersDevCount },
        revenue: { submitted: !!revenue, data: revenue },
        feeStructure: { submitted: feeStructureCount > 0, count: feeStructureCount },
        revenueBudgetTotal: { submitted: !!revBudgetTotal },
        revenueBudgetMonthly: { submitted: revBudgetMonthlyCount > 0, count: revBudgetMonthlyCount },
        revenueActualTotal: { submitted: !!revActualTotal },
        revenueActualMonthly: { submitted: revActualMonthlyCount > 0, count: revActualMonthlyCount },
        performance: { submitted: !!performance, data: performance },
        alumni: { submitted: alumni.length > 0, count: alumni.length, data: alumni },
        pedagogicalAchievements: { submitted: pedagAchievCount > 0, count: pedagAchievCount },
        cocurricular: { submitted: cocurricularCount > 0, count: cocurricularCount },
        studentsPerformance: { submitted: studentsPerfCount > 0, count: studentsPerfCount },
        studentPerformance: { submitted: studentPerfCount > 0, count: studentPerfCount },
        activityParticipation: { submitted: activityPartCount > 0, count: activityPartCount },
        eventParticipation: { submitted: eventPartCount > 0, count: eventPartCount },
      },
    };
  }

  // ===================== Basic Information =====================

  async upsertBasicInfo(dto: UpsertBasicInfoDto, userId: string, roles: string[]): Promise<DcBasicInfo> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.basicInfoRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.basicInfoRepo.create({ ...dto, createdById: userId });
    }
    return this.basicInfoRepo.save(record);
  }

  async getBasicInfo(
    schoolId: string,
    userId: string,
    roles: string[],
    academicYear?: number,
  ): Promise<DcBasicInfo | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.basicInfoRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  // ===================== Infrastructure =====================

  async upsertInfrastructure(dto: UpsertInfrastructureDto, userId: string, roles: string[]): Promise<DcInfrastructure> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.infraRepo.findOne({ where: { schoolId: dto.schoolId, academicYear: dto.academicYear } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.infraRepo.create({ ...dto, createdById: userId });
    }
    return this.infraRepo.save(record);
  }

  async getInfrastructure(schoolId: string, userId: string, roles: string[], academicYear?: number): Promise<DcInfrastructure | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.infraRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  /**
   * Soft-delete the yearly infrastructure record. NOTE: the entity stores
   * BOTH the Infrastructure Status and Classroom Status forms' data in a
   * single row, so deleting it removes both for that academic year.
   */
  async deleteInfrastructure(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.infraRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Infrastructure record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.infraRepo.softRemove(record);
  }

  // ===================== Students Info =====================

  async upsertStudentsInfo(dto: UpsertStudentsInfoDto, userId: string, roles: string[]): Promise<DcStudentsInfo> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.studentsRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month, grade: dto.grade },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.studentsRepo.create({ ...dto, createdById: userId });
    }
    return this.studentsRepo.save(record);
  }

  async getStudentsInfo(schoolId: string, userId: string, roles: string[]): Promise<DcStudentsInfo[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const GRADE_ORDER = ['play_learn','nursery','g1','g2','g3','g4','g5','g6','g7','g8','g9','g10'];
    const records = await this.studentsRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
    });
    return records.sort((a, b) => {
      const yDiff = this.compareYearThenMonth(a, b);
      if (yDiff !== 0) return yDiff;
      return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
    });
  }

  async deleteStudentsInfo(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.studentsRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Student record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.studentsRepo.softRemove(record);
  }

  // ===================== Teachers Info =====================

  async upsertTeachersInfo(dto: UpsertTeachersInfoDto, userId: string, roles: string[]): Promise<DcTeachersInfo> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.teachersRepo.findOne({ where: { schoolId: dto.schoolId } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.teachersRepo.create({ ...dto, createdById: userId });
    }
    return this.teachersRepo.save(record);
  }

  async getTeachersInfo(schoolId: string, userId: string, roles: string[]): Promise<DcTeachersInfo | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.teachersRepo.findOne({ where: { schoolId } });
  }

  // ===================== Teacher Individual (multi-entry) =====================

  async createTeacherIndividual(dto: CreateTeacherIndividualDto, userId: string, roles: string[]): Promise<DcTeacherIndividual> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const record = this.teacherIndividualRepo.create({ ...dto, createdById: userId });
    return this.teacherIndividualRepo.save(record);
  }

  async getTeacherIndividuals(schoolId: string, userId: string, roles: string[]): Promise<DcTeacherIndividual[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.teacherIndividualRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
      order: { academicYear: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateTeacherIndividual(id: string, dto: UpdateTeacherIndividualDto, userId: string, roles: string[]): Promise<DcTeacherIndividual> {
    const record = await this.teacherIndividualRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Teacher record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.assertCanEditExisting(true, userId, roles);
    const { schoolId: _ignored, ...rest } = dto as CreateTeacherIndividualDto & { schoolId?: string };
    Object.assign(record, rest);
    return this.teacherIndividualRepo.save(record);
  }

  async deleteTeacherIndividual(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.teacherIndividualRepo.findOne({
      where: { id },
      relations: { school: true },
    });
    if (!record) throw new NotFoundException('Teacher record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.teacherIndividualRepo.softRemove(record);
  }

  // ===================== Teachers Development (per month) =====================

  async upsertTeachersDevelopment(dto: UpsertTeachersDevelopmentDto, userId: string, roles: string[]): Promise<DcTeachersDevelopment> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.teachersDevRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.teachersDevRepo.create({ ...dto, createdById: userId });
    }
    return this.teachersDevRepo.save(record);
  }

  async getTeachersDevelopment(schoolId: string, userId: string, roles: string[]): Promise<DcTeachersDevelopment[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const records = await this.teachersDevRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
    });
    return records.sort((a, b) => this.compareYearThenMonth(a, b));
  }

  async deleteTeachersDevelopment(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.teachersDevRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Development record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.teachersDevRepo.softRemove(record);
  }

  // ===================== Revenue =====================

  async upsertRevenue(dto: UpsertRevenueDto, userId: string, roles: string[]): Promise<DcRevenue> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.revenueRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.revenueRepo.create({ ...dto, createdById: userId });
    }
    return this.revenueRepo.save(record);
  }

  async getRevenue(
    schoolId: string,
    userId: string,
    roles: string[],
    academicYear?: number,
  ): Promise<DcRevenue | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revenueRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  // ===================== Performance =====================

  async upsertPerformance(dto: UpsertPerformanceDto, userId: string, roles: string[]): Promise<DcPerformance> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.performanceRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.performanceRepo.create({ ...dto, createdById: userId });
    }
    return this.performanceRepo.save(record);
  }

  async getPerformance(
    schoolId: string,
    userId: string,
    roles: string[],
    academicYear?: number,
  ): Promise<DcPerformance | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.performanceRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  // ===================== Alumni =====================

  async createAlumni(dto: CreateAlumniDto, userId: string, roles: string[]): Promise<DcAlumni> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const record = this.alumniRepo.create({ ...dto, createdById: userId });
    return this.alumniRepo.save(record);
  }

  async getAlumniBySchool(schoolId: string, userId: string, roles: string[]): Promise<DcAlumni[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.alumniRepo.find({ where: { schoolId }, order: { academicYear: 'DESC', createdAt: 'DESC' } });
  }

  async updateAlumni(id: string, dto: UpdateAlumniDto, userId: string, roles: string[]): Promise<DcAlumni> {
    const record = await this.alumniRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Alumni record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.assertCanEditExisting(true, userId, roles);
    Object.assign(record, dto);
    return this.alumniRepo.save(record);
  }

  async deleteAlumni(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.alumniRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Alumni record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.alumniRepo.softRemove(record);
  }

  // ===================== Fee Structure =====================

  async upsertFeeStructure(dto: UpsertFeeStructureDto, userId: string, roles: string[]): Promise<DcFeeStructure> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.feeStructureRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month, grade: dto.grade },
      relations: ['createdBy', 'updatedBy'],
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      const prev = { ...record };
      Object.assign(record, dto, { updatedById: userId });
      await this.feeStructureRepo.save(record);
      // Write audit log
      await this.feeStructureLogRepo.save(
        this.feeStructureLogRepo.create({
          schoolId: dto.schoolId,
          month: dto.month,
          grade: dto.grade,
          previousData: prev as unknown as Record<string, unknown>,
          newData: record as unknown as Record<string, unknown>,
          editedById: userId,
        }),
      );
    } else {
      record = this.feeStructureRepo.create({ ...dto, createdById: userId });
      await this.feeStructureRepo.save(record);
    }
    return record;
  }

  async getFeeStructures(schoolId: string, userId: string, roles: string[]): Promise<DcFeeStructure[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const records = await this.feeStructureRepo.find({
      where: { schoolId },
      relations: ['createdBy', 'updatedBy'],
    });
    return records.sort((a, b) => {
      const d = this.compareYearThenMonth(a, b);
      return d !== 0 ? d : a.grade.localeCompare(b.grade);
    });
  }

  async getFeeStructureLogs(schoolId: string, userId: string, roles: string[]): Promise<DcFeeStructureLog[]> {
    if (!this.isAdminRole(roles)) throw new ForbiddenException('Access denied');
    return this.feeStructureLogRepo.find({
      where: { schoolId },
      relations: ['editedBy'],
      order: { editedAt: 'DESC' },
    });
  }

  async deleteFeeStructure(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.feeStructureRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Fee structure record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.feeStructureRepo.softRemove(record);
  }

  // ===================== Revenue Budget Total =====================

  async upsertRevenueBudgetTotal(dto: UpsertRevenueBudgetTotalDto, userId: string, roles: string[]): Promise<DcRevenueBudgetTotal> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.revBudgetTotalRepo.findOne({ where: { schoolId: dto.schoolId, academicYear: dto.academicYear } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto, { updatedById: userId });
    } else {
      record = this.revBudgetTotalRepo.create({ ...dto, createdById: userId });
    }
    return this.revBudgetTotalRepo.save(record);
  }

  async getRevenueBudgetTotal(schoolId: string, userId: string, roles: string[], academicYear?: number): Promise<DcRevenueBudgetTotal | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revBudgetTotalRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  async deleteRevenueBudgetTotal(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.revBudgetTotalRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Revenue record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.revBudgetTotalRepo.softRemove(record);
  }

  // ===================== Revenue Budget Monthly =====================

  private calcPct(target: number, achievement: number): number {
    if (!target || target === 0) return 0;
    return Math.min(parseFloat(((achievement / target) * 100).toFixed(2)), 9999.99);
  }

  async upsertRevenueBudgetMonthly(dto: UpsertRevenueBudgetMonthlyDto, userId: string, roles: string[]): Promise<DcRevenueBudgetMonthly> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const collectionPct = this.calcPct(dto.tuitionFeeTarget ?? 0, dto.tuitionFeeAchievement ?? 0);
    let record = await this.revBudgetMonthlyRepo.findOne({ where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto, { collectionPct, updatedById: userId });
    } else {
      record = this.revBudgetMonthlyRepo.create({ ...dto, collectionPct, createdById: userId });
    }
    return this.revBudgetMonthlyRepo.save(record);
  }

  async getRevenueBudgetMonthly(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueBudgetMonthly[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const records = await this.revBudgetMonthlyRepo.find({ where: { schoolId } });
    return records.sort((a, b) => this.compareYearThenMonth(a, b));
  }

  async deleteRevenueBudgetMonthly(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.revBudgetMonthlyRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Revenue record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.revBudgetMonthlyRepo.softRemove(record);
  }

  // ===================== Revenue Actual Total =====================

  async upsertRevenueActualTotal(dto: UpsertRevenueActualTotalDto, userId: string, roles: string[]): Promise<DcRevenueActualTotal> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.revActualTotalRepo.findOne({ where: { schoolId: dto.schoolId, academicYear: dto.academicYear } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto, { updatedById: userId });
    } else {
      record = this.revActualTotalRepo.create({ ...dto, createdById: userId });
    }
    return this.revActualTotalRepo.save(record);
  }

  async getRevenueActualTotal(schoolId: string, userId: string, roles: string[], academicYear?: number): Promise<DcRevenueActualTotal | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revActualTotalRepo.findOne({
      where: academicYear ? { schoolId, academicYear } : { schoolId },
      order: { academicYear: 'DESC' },
    });
  }

  async deleteRevenueActualTotal(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.revActualTotalRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Revenue record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.revActualTotalRepo.softRemove(record);
  }

  // ===================== Revenue Actual Monthly =====================

  async upsertRevenueActualMonthly(dto: UpsertRevenueActualMonthlyDto, userId: string, roles: string[]): Promise<DcRevenueActualMonthly> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const collectionPct = this.calcPct(dto.tuitionFeeTarget ?? 0, dto.tuitionFeeAchievement ?? 0);
    let record = await this.revActualMonthlyRepo.findOne({ where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto, { collectionPct, updatedById: userId });
    } else {
      record = this.revActualMonthlyRepo.create({ ...dto, collectionPct, createdById: userId });
    }
    return this.revActualMonthlyRepo.save(record);
  }

  async getRevenueActualMonthly(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueActualMonthly[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const records = await this.revActualMonthlyRepo.find({ where: { schoolId } });
    return records.sort((a, b) => this.compareYearThenMonth(a, b));
  }

  async deleteRevenueActualMonthly(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.revActualMonthlyRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Revenue record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.revActualMonthlyRepo.softRemove(record);
  }

  // ===================== Pedagogical Achievements =====================

  async upsertPedagogicalAchievement(dto: UpsertPedagogicalAchievementDto, userId: string, roles: string[]): Promise<DcPedagogicalAchievement> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.pedagAchievRepo.findOne({ where: { schoolId: dto.schoolId, year: dto.year } });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.pedagAchievRepo.create({ ...dto, createdById: userId });
    }
    return this.pedagAchievRepo.save(record);
  }

  async getPedagogicalAchievements(schoolId: string, userId: string, roles: string[]): Promise<DcPedagogicalAchievement[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.pedagAchievRepo.find({ where: { schoolId }, order: { year: 'DESC' } });
  }

  async deletePedagogicalAchievement(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.pedagAchievRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.pedagAchievRepo.softRemove(record);
  }

  // ===================== Co-curricular =====================

  async upsertCocurricular(dto: UpsertCocurricularDto, userId: string, roles: string[]): Promise<DcCocurricular> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.cocurricularRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear, month: dto.month, grade: dto.grade },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.cocurricularRepo.create({ ...dto, createdById: userId });
    }
    return this.cocurricularRepo.save(record);
  }

  async getCocurricular(schoolId: string, userId: string, roles: string[]): Promise<DcCocurricular[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.cocurricularRepo.find({ where: { schoolId }, order: { academicYear: 'DESC', month: 'ASC', grade: 'ASC' } });
  }

  async deleteCocurricular(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.cocurricularRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.cocurricularRepo.softRemove(record);
  }

  // ===================== Students' Performance =====================

  async upsertStudentsPerformance(dto: UpsertStudentsPerformanceDto, userId: string, roles: string[]): Promise<DcStudentsPerformance> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.studentsPerfRepo.findOne({
      where: { schoolId: dto.schoolId, academicYear: dto.academicYear, grade: dto.grade, examName: dto.examName },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.studentsPerfRepo.create({ ...dto, createdById: userId });
    }
    return this.studentsPerfRepo.save(record);
  }

  async getStudentsPerformance(schoolId: string, userId: string, roles: string[]): Promise<DcStudentsPerformance[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.studentsPerfRepo.find({ where: { schoolId }, order: { academicYear: 'DESC', grade: 'ASC', examName: 'ASC' } });
  }

  async deleteStudentsPerformance(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.studentsPerfRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.studentsPerfRepo.softRemove(record);
  }

  // ===================== Student Performance (BA / BPS / BSS) =====================

  /** School category -> applicable formKey prefix (BA -> brac_academy, etc.). */
  private static readonly PERF_FORM_KEY_BY_CATEGORY: Record<string, string> = {
    brac_academy: 'ba-',
    brac_primary: 'bps-',
    brac_secondary: 'bss-',
  };

  /** A BA/BPS/BSS form only applies to the school type it belongs to. */
  private assertFormKeyMatchesSchool(school: DcSchool, formKey: string): void {
    const expectedPrefix = DataCollectionService.PERF_FORM_KEY_BY_CATEGORY[school.schoolCategory];
    if (!expectedPrefix || !formKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        `Form "${formKey}" is not applicable for this school type (${school.schoolCategory ?? 'unknown category'})`,
      );
    }
  }

  async upsertStudentPerformance(dto: UpsertStudentPerformanceDto, userId: string, roles: string[]): Promise<DcStudentPerformance> {
    const school = await this.validateSchoolAccess(dto.schoolId, userId, roles);
    this.assertFormKeyMatchesSchool(school, dto.formKey);
    let record = await this.studentPerfRepo.findOne({
      where: {
        schoolId: dto.schoolId,
        academicYear: dto.academicYear,
        formKey: dto.formKey,
        grade: dto.grade,
        evaluationPeriod: dto.evaluationPeriod,
      },
    });
    await this.assertCanEditExisting(!!record, userId, roles);

    const rows = dto.rows.map((r) => ({
      code: r.code,
      label: r.label,
      ...(r.domain ? { domain: r.domain } : {}),
      values: Object.fromEntries(
        Object.entries(r.values ?? {}).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]),
      ),
    }));

    if (dto.appearedPercent != null && dto.numberOfStudents) {
      for (const row of rows) {
        const rowTotal = Object.values(row.values).reduce((sum, v) => sum + v, 0);
        // Unfilled rows (every scale left blank) are allowed — the entry form
        // only validates rows the user actually typed into.
        if (rowTotal > 0 && rowTotal !== dto.appearedPercent) {
          throw new BadRequestException(
            `Row "${row.label}" total (${rowTotal}) must equal Students appeared in the Evaluation (${dto.appearedPercent}).`,
          );
        }
        for (const [scale, value] of Object.entries(row.values)) {
          if (value > dto.numberOfStudents) {
            throw new BadRequestException(
              `Value for "${scale}" in row "${row.label}" (${value}) cannot exceed Number of Students (${dto.numberOfStudents}).`,
            );
          }
        }
      }
    }

    if (record) {
      Object.assign(record, dto, { rows });
    } else {
      record = this.studentPerfRepo.create({ ...dto, rows, createdById: userId });
    }
    return this.studentPerfRepo.save(record);
  }

  async getStudentPerformance(
    schoolId: string,
    userId: string,
    roles: string[],
    formKey?: string,
  ): Promise<DcStudentPerformance[]> {
    const school = await this.validateSchoolAccess(schoolId, userId, roles);
    if (formKey) this.assertFormKeyMatchesSchool(school, formKey);
    return this.studentPerfRepo.find({
      where: { schoolId, ...(formKey ? { formKey } : {}) },
      order: { academicYear: 'DESC', formKey: 'ASC', grade: 'ASC', evaluationPeriod: 'ASC' },
    });
  }

  /**
   * Same records as getStudentPerformance() but with the jsonb `rows` flattened
   * into "<indicator> — <scale>" columns, for the generic School Information
   * form-data viewer/export.
   */
  async getStudentPerformanceFlat(
    schoolId: string,
    userId: string,
    roles: string[],
    formKey: string,
  ): Promise<Record<string, unknown>[]> {
    const records = await this.getStudentPerformance(schoolId, userId, roles, formKey);
    return records.map((rec) => {
      const flat: Record<string, unknown> = {
        academicYear: rec.academicYear,
        grade: rec.grade,
        evaluationPeriod: rec.evaluationPeriod,
        numberOfStudents: rec.numberOfStudents,
        appearedPercent: rec.appearedPercent,
      };
      for (const row of rec.rows ?? []) {
        for (const [scale, value] of Object.entries(row.values ?? {})) {
          flat[`${row.code}. ${row.label} — ${scale}`] = value;
        }
      }
      flat.createdAt = rec.createdAt;
      return flat;
    });
  }

  async deleteStudentPerformance(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.studentPerfRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.studentPerfRepo.softRemove(record);
  }

  // ===================== Activity Participation (Corner/Club/Library/Lab) =====================

  async upsertActivityParticipation(dto: UpsertActivityParticipationDto, userId: string, roles: string[]): Promise<DcActivityParticipation> {    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.activityPartRepo.findOne({
      where: { schoolId: dto.schoolId, item: dto.item, year: dto.year, month: dto.month, grade: dto.grade },
    });
    await this.assertCanEditExisting(!!record, userId, roles);
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.activityPartRepo.create({ ...dto, createdById: userId });
    }
    return this.activityPartRepo.save(record);
  }

  async getActivityParticipation(schoolId: string, userId: string, roles: string[]): Promise<DcActivityParticipation[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.activityPartRepo.find({ where: { schoolId }, order: { year: 'DESC', month: 'ASC', item: 'ASC', grade: 'ASC' } });
  }

  async deleteActivityParticipation(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.activityPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.activityPartRepo.softRemove(record);
  }

  // ===================== Event Participation =====================

  async createEventParticipation(dto: CreateEventParticipationDto, userId: string, roles: string[]): Promise<DcEventParticipation> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const totalAwarded = (dto.maleAwarded || 0) + (dto.femaleAwarded || 0) + (dto.othersAwarded || 0);
    const record = this.eventPartRepo.create({ ...dto, totalAwarded, createdById: userId });
    return this.eventPartRepo.save(record);
  }

  async getEventParticipation(schoolId: string, userId: string, roles: string[]): Promise<DcEventParticipation[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.eventPartRepo.find({ where: { schoolId }, order: { academicYear: 'DESC', createdAt: 'DESC' } });
  }

  async updateEventParticipation(id: string, dto: UpdateEventParticipationDto, userId: string, roles: string[]): Promise<DcEventParticipation> {
    const record = await this.eventPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Event participation record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.assertCanEditExisting(true, userId, roles);
    Object.assign(record, dto);
    record.totalAwarded = (record.maleAwarded || 0) + (record.femaleAwarded || 0) + (record.othersAwarded || 0);
    return this.eventPartRepo.save(record);
  }

  async deleteEventParticipation(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.eventPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Event participation record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.eventPartRepo.softRemove(record);
  }

  // ===================== Programme Overview (aggregated) =====================

  private static readonly MONTH_ORDER = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  /**
   * Students' Information is captured once per school/year/grade/MONTH, so summing
   * the raw rows counts the same pupils again for every month reported. Collapse to
   * the latest reported month per school+grade — that snapshot is the enrolment.
   */
  private latestStudentSnapshot(records: DcStudentsInfo[]): DcStudentsInfo[] {
    const latest = new Map<string, DcStudentsInfo>();
    for (const rec of records) {
      const key = `${rec.schoolId}::${rec.grade}`;
      const current = latest.get(key);
      const order = DataCollectionService.MONTH_ORDER;
      if (!current || order.indexOf(rec.month) >= order.indexOf(current.month)) {
        latest.set(key, rec);
      }
    }
    return [...latest.values()];
  }

  /**
   * Distinct academic years that have any submitted data for the given schools,
   * newest first. `dc_activity_participation` / `dc_pedagogical_achievement`
   * keep their year in a `year` column instead of `academicYear`.
   */
  private async getAvailableAcademicYears(schoolIds: string[]): Promise<number[]> {
    if (schoolIds.length === 0) return [];

    const sources: { repo: Repository<any>; field: string }[] = [
      { repo: this.basicInfoRepo, field: 'academicYear' },
      { repo: this.infraRepo, field: 'academicYear' },
      { repo: this.studentsRepo, field: 'academicYear' },
      { repo: this.teacherIndividualRepo, field: 'academicYear' },
      { repo: this.teachersDevRepo, field: 'academicYear' },
      { repo: this.feeStructureRepo, field: 'academicYear' },
      { repo: this.revBudgetTotalRepo, field: 'academicYear' },
      { repo: this.revActualTotalRepo, field: 'academicYear' },
      { repo: this.revBudgetMonthlyRepo, field: 'academicYear' },
      { repo: this.revActualMonthlyRepo, field: 'academicYear' },
      { repo: this.cocurricularRepo, field: 'academicYear' },
      { repo: this.studentsPerfRepo, field: 'academicYear' },
      { repo: this.studentPerfRepo, field: 'academicYear' },
      { repo: this.performanceRepo, field: 'academicYear' },
      { repo: this.revenueRepo, field: 'academicYear' },
      { repo: this.eventPartRepo, field: 'academicYear' },
      { repo: this.alumniRepo, field: 'academicYear' },
      { repo: this.activityPartRepo, field: 'year' },
      { repo: this.pedagAchievRepo, field: 'year' },
    ];

    const results = await Promise.all(
      sources.map(({ repo, field }) =>
        repo
          .createQueryBuilder('r')
          .select(`DISTINCT r.${field}`, 'year')
          .where('r.schoolId IN (:...ids)', { ids: schoolIds })
          .getRawMany<{ year: number | string | null }>(),
      ),
    );

    const years = new Set<number>();
    for (const rows of results) {
      for (const row of rows) {
        const y = Number(row.year);
        // 0 is the entity default for rows created before academicYear existed.
        if (Number.isFinite(y) && y > 0) years.add(y);
      }
    }
    return [...years].sort((a, b) => b - a);
  }

  async getProgrammeOverview(
    userId: string,
    roles: string[],
    category?: string,
    academicYear?: number,
  ) {
    const admin = this.isAdminRole(roles);
    const categoryWhere = category ? { schoolCategory: category } : {};

    let where: any;
    if (admin) {
      where = { ...categoryWhere };
    } else {
      const assignedIds = await this.getAssignedSchoolIds(userId);
      where = assignedIds.length
        ? [
            { createdById: userId, ...categoryWhere },
            { id: In(assignedIds), ...categoryWhere },
          ]
        : [{ createdById: userId, ...categoryWhere }];
    }

    const schools = await this.schoolRepo.find({ where });
    const schoolIds = schools.map((s) => s.id);

    if (schoolIds.length === 0) {
      return this.emptyOverview(schools, academicYear ?? null, []);
    }

    // Every dc_* table now stores one row per academic year, so without this
    // filter a school with two years of data would be counted twice.
    const availableYears = await this.getAvailableAcademicYears(schoolIds);
    const year = academicYear ?? availableYears[0] ?? null;

    const teacherQb = this.teacherIndividualRepo
      .createQueryBuilder('t')
      .select('t.school_id', 'schoolId')
      .addSelect('t.gender', 'gender')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.school_id IN (:...ids)', { ids: schoolIds })
      .groupBy('t.school_id')
      .addGroupBy('t.gender');
    if (year != null) teacherQb.andWhere('t.academic_year = :year', { year });

    const studentWhere = {
      schoolId: In(schoolIds),
      ...(year != null ? { academicYear: year } : {}),
    };

    const revenueWhere = schoolIds.map((id) =>
      year != null ? { schoolId: id, academicYear: year } : { schoolId: id },
    );

    // Parallel aggregate queries
    const [teacherRows, studentRecords, budgetTotals, actualTotals] = await Promise.all([
      teacherQb.getRawMany(),
      this.studentsRepo.find({ where: studentWhere }),
      this.revBudgetTotalRepo.find({ where: revenueWhere }),
      this.revActualTotalRepo.find({ where: revenueWhere }),
    ]);

    // Aggregate teacher counts
    const teacherMap: Record<string, { male: number; female: number }> = {};
    for (const row of teacherRows) {
      if (!teacherMap[row.schoolId]) teacherMap[row.schoolId] = { male: 0, female: 0 };
      const g = (row.gender ?? '').toLowerCase();
      if (g === 'male') teacherMap[row.schoolId].male += parseInt(row.cnt, 10);
      else if (g === 'female') teacherMap[row.schoolId].female += parseInt(row.cnt, 10);
    }

    // Aggregate student counts from the latest reported month per school+grade
    const studentMap: Record<string, { boys: number; girls: number; total: number; pwd: number; ethnic: number }> = {};
    for (const rec of this.latestStudentSnapshot(studentRecords)) {
      const entry = (studentMap[rec.schoolId] ??= { boys: 0, girls: 0, total: 0, pwd: 0, ethnic: 0 });
      entry.boys += rec.boys || 0;
      entry.girls += rec.girls || 0;
      entry.total += rec.total || 0;
      entry.pwd += rec.personsWithDisability || 0;
      entry.ethnic += rec.ethnic || 0;
    }

    // Revenue maps
    const budgetMap: Record<string, typeof budgetTotals[0]> = {};
    for (const r of budgetTotals) budgetMap[r.schoolId] = r;
    const actualMap: Record<string, typeof actualTotals[0]> = {};
    for (const r of actualTotals) actualMap[r.schoolId] = r;

    // Build per-school rows
    const schoolRows = schools.map((school) => {
      const t = teacherMap[school.id] ?? { male: 0, female: 0 };
      const s = studentMap[school.id] ?? { boys: 0, girls: 0, total: 0, pwd: 0, ethnic: 0 };
      const b = budgetMap[school.id];
      const a = actualMap[school.id];

      const sumBudgetTarget = b
        ? [b.admissionFeeTarget, b.sessionFeeTarget, b.assessmentFeeTarget, b.sportsFeeTarget, b.syllabusFeeTarget, b.testimonialFeeTarget, b.othersFeeTarget, b.transportFeeTarget]
            .reduce((acc, v) => acc + parseFloat(String(v ?? 0)), 0)
        : 0;
      const sumBudgetAchievement = b
        ? [b.admissionFeeAchievement, b.sessionFeeAchievement, b.assessmentFeeAchievement, b.sportsFeeAchievement, b.syllabusFeeAchievement, b.testimonialFeeAchievement, b.othersFeeAchievement, b.transportFeeAchievement]
            .reduce((acc, v) => acc + parseFloat(String(v ?? 0)), 0)
        : 0;
      const sumActualTarget = a
        ? [a.admissionFeeTarget, a.sessionFeeTarget, a.assessmentFeeTarget, a.sportsFeeTarget, a.syllabusFeeTarget, a.testimonialFeeTarget, a.othersFeeTarget, a.transportFeeTarget]
            .reduce((acc, v) => acc + parseFloat(String(v ?? 0)), 0)
        : 0;
      const sumActualAchievement = a
        ? [a.admissionFeeAchievement, a.sessionFeeAchievement, a.assessmentFeeAchievement, a.sportsFeeAchievement, a.syllabusFeeAchievement, a.testimonialFeeAchievement, a.othersFeeAchievement, a.transportFeeAchievement]
            .reduce((acc, v) => acc + parseFloat(String(v ?? 0)), 0)
        : 0;

      return {
        id: school.id,
        name: school.name,
        code: school.code,
        category: school.schoolCategory ?? 'Unknown',
        district: school.district,
        division: school.division,
        upazila: school.upazila,
        establishedYear: school.establishedYear ?? null,
        governmentApproval: school.governmentApproval ?? null,
        teachers: { male: t.male, female: t.female, total: t.male + t.female },
        students: s,
        yearlyStudentTarget: b?.totalStudentsTarget ?? a?.totalStudentsTarget ?? 0,
        budgetRevenueTarget: sumBudgetTarget,
        budgetRevenueAchievement: sumBudgetAchievement,
        actualRevenueTarget: sumActualTarget,
        actualRevenueAchievement: sumActualAchievement,
      };
    });

    // Programme totals
    const totals = schoolRows.reduce(
      (acc, r) => {
        acc.totalSchools++;
        acc.totalTeachersMale += r.teachers.male;
        acc.totalTeachersFemale += r.teachers.female;
        acc.totalTeachers += r.teachers.total;
        acc.totalStudentsBoys += r.students.boys;
        acc.totalStudentsGirls += r.students.girls;
        acc.totalStudents += r.students.total;
        acc.totalPWD += r.students.pwd;
        acc.totalEthnic += r.students.ethnic;
        acc.yearlyStudentTarget += r.yearlyStudentTarget;
        acc.budgetRevenueTarget += r.budgetRevenueTarget;
        acc.budgetRevenueAchievement += r.budgetRevenueAchievement;
        acc.actualRevenueTarget += r.actualRevenueTarget;
        acc.actualRevenueAchievement += r.actualRevenueAchievement;
        return acc;
      },
      {
        totalSchools: 0, totalTeachersMale: 0, totalTeachersFemale: 0, totalTeachers: 0,
        totalStudentsBoys: 0, totalStudentsGirls: 0, totalStudents: 0, totalPWD: 0, totalEthnic: 0,
        yearlyStudentTarget: 0, budgetRevenueTarget: 0, budgetRevenueAchievement: 0,
        actualRevenueTarget: 0, actualRevenueAchievement: 0,
      },
    );

    // Category breakdown
    const categories: Record<string, typeof totals> = {};
    for (const r of schoolRows) {
      const cat = r.category;
      if (!categories[cat]) {
        categories[cat] = { ...totals };
        Object.keys(categories[cat]).forEach((k) => (categories[cat][k as keyof typeof totals] = 0));
      }
      categories[cat].totalSchools++;
      categories[cat].totalTeachersMale += r.teachers.male;
      categories[cat].totalTeachersFemale += r.teachers.female;
      categories[cat].totalTeachers += r.teachers.total;
      categories[cat].totalStudentsBoys += r.students.boys;
      categories[cat].totalStudentsGirls += r.students.girls;
      categories[cat].totalStudents += r.students.total;
      categories[cat].totalPWD += r.students.pwd;
      categories[cat].totalEthnic += r.students.ethnic;
      categories[cat].yearlyStudentTarget += r.yearlyStudentTarget;
      categories[cat].budgetRevenueTarget += r.budgetRevenueTarget;
      categories[cat].budgetRevenueAchievement += r.budgetRevenueAchievement;
      categories[cat].actualRevenueTarget += r.actualRevenueTarget;
      categories[cat].actualRevenueAchievement += r.actualRevenueAchievement;
    }

    return { totals, categories, schools: schoolRows, academicYear: year, availableYears };
  }

  private emptyOverview(
    schools: DcSchool[],
    academicYear: number | null = null,
    availableYears: number[] = [],
  ) {
    return {
      totals: {
        totalSchools: 0, totalTeachersMale: 0, totalTeachersFemale: 0, totalTeachers: 0,
        totalStudentsBoys: 0, totalStudentsGirls: 0, totalStudents: 0, totalPWD: 0, totalEthnic: 0,
        yearlyStudentTarget: 0, budgetRevenueTarget: 0, budgetRevenueAchievement: 0,
        actualRevenueTarget: 0, actualRevenueAchievement: 0,
      },
      categories: {},
      schools: [],
      academicYear,
      availableYears,
    };
  }

  // ===================== School Profile Overview =====================

  async getSchoolProfile(
    schoolId: string,
    userId: string,
    roles: string[],
    academicYear?: number,
  ) {
    const school = await this.validateSchoolAccess(schoolId, userId, roles);

    // Scope every category to a single academic year, otherwise the aggregated
    // status-breakdown tables would sum multiple years' rows together.
    const availableYears = await this.getAvailableAcademicYears([schoolId]);
    const year = academicYear ?? availableYears[0] ?? null;
    const yearWhere: { academicYear?: number } = year != null ? { academicYear: year } : {};
    // Activity participation + pedagogical achievements use a `year` column.
    const legacyYearWhere: { year?: number } = year != null ? { year } : {};

    const [
      infrastructure,
      students,
      teachers,
      teachersDevelopment,
      feeStructures,
      revenueBudgetTotal,
      revenueActualTotal,
      pedagogicalAchievements,
      performance,
      cocurricular,
      studentsPerformance,
      activityParticipation,
      eventParticipation,
      alumni,
    ] = await Promise.all([
      this.infraRepo.findOne({ where: { schoolId, ...yearWhere }, order: { academicYear: 'DESC' } }),
      this.studentsRepo.find({ where: { schoolId, ...yearWhere } }),
      this.teacherIndividualRepo.find({ where: { schoolId, ...yearWhere }, order: { name: 'ASC' } }),
      this.teachersDevRepo.find({ where: { schoolId, ...yearWhere } }),
      this.feeStructureRepo.find({ where: { schoolId, ...yearWhere } }),
      this.revBudgetTotalRepo.findOne({ where: { schoolId, ...yearWhere }, order: { academicYear: 'DESC' } }),
      this.revActualTotalRepo.findOne({ where: { schoolId, ...yearWhere }, order: { academicYear: 'DESC' } }),
      this.pedagAchievRepo.find({ where: { schoolId, ...legacyYearWhere }, order: { year: 'DESC' } }),
      this.performanceRepo.findOne({ where: { schoolId, ...yearWhere }, order: { academicYear: 'DESC' } }),
      this.cocurricularRepo.find({ where: { schoolId, ...yearWhere } }),
      this.studentsPerfRepo.find({ where: { schoolId, ...yearWhere } }),
      this.activityPartRepo.find({ where: { schoolId, ...legacyYearWhere } }),
      this.eventPartRepo.find({ where: { schoolId, ...yearWhere } }),
      this.alumniRepo.find({ where: { schoolId, ...yearWhere }, order: { graduationYear: 'DESC' } }),
    ]);

    // ── Aggregate students by grade (latest month snapshot per grade) ──
    const studentsByGrade = this.latestStudentSnapshot(students);
    const studentTotals = studentsByGrade.reduce(
      (acc, r) => ({
        boys: acc.boys + (r.boys || 0),
        girls: acc.girls + (r.girls || 0),
        pwd: acc.pwd + (r.personsWithDisability || 0),
        ethnic: acc.ethnic + (r.ethnic || 0),
        total: acc.total + (r.total || 0),
      }),
      { boys: 0, girls: 0, pwd: 0, ethnic: 0, total: 0 },
    );

    // ── Teacher gender split ──
    const teacherTotals = teachers.reduce(
      (acc, t) => ({
        male: acc.male + (t.gender === 'Male' ? 1 : 0),
        female: acc.female + (t.gender === 'Female' ? 1 : 0),
        total: acc.total + 1,
      }),
      { male: 0, female: 0, total: 0 },
    );

    // Month-name column can't be ordered in SQL. Sort oldest → newest so the
    // status tables can read the most recent assessment off the end.
    teachersDevelopment.sort((a, b) => {
      const yDiff = Number(a.academicYear ?? 0) - Number(b.academicYear ?? 0);
      if (yDiff !== 0) return yDiff;
      const order = DataCollectionService.MONTH_ORDER;
      return order.indexOf(a.month) - order.indexOf(b.month);
    });

    // Count of the 6 categories that have at least one record (used for the
    // placeholder grade / completeness indicator until a real rating exists).
    const categoriesWithData = [
      !!infrastructure,
      studentsByGrade.length > 0,
      teachers.length > 0,
      feeStructures.length > 0 || !!revenueBudgetTotal || !!revenueActualTotal,
      pedagogicalAchievements.length > 0 || !!performance,
      alumni.length > 0,
    ].filter(Boolean).length;

    return {
      school,
      infrastructure,
      students: studentsByGrade,
      studentTotals,
      teachers,
      teacherTotals,
      teachersDevelopment,
      feeStructures,
      revenueBudgetTotal,
      revenueActualTotal,
      pedagogicalAchievements,
      performance,
      cocurricular,
      studentsPerformance,
      activityParticipation,
      eventParticipation,
      alumni,
      meta: {
        categoriesWithData,
        totalCategories: 6,
        academicYear: year,
        availableYears,
      },
    };
  }

  // ===================== Form Drafts (server-side, per-user) =====================
  //
  // Drafts let a user save in-progress form data privately so it's visible if
  // they come back later on ANY device (unlike the old localStorage-only
  // version). Always scoped by userId in the query — a user can only ever
  // read/write their OWN drafts, and drafts are never exposed to other users
  // or reflected in real form responses/dashboards.

  async getFormDraft(
    schoolId: string,
    formKey: string,
    userId: string,
    roles: string[],
  ): Promise<DcFormDraft | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.formDraftRepo.findOne({ where: { schoolId, formKey, userId } });
  }

  async saveFormDraft(dto: UpsertFormDraftDto, userId: string, roles: string[]): Promise<DcFormDraft> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let draft = await this.formDraftRepo.findOne({
      where: { schoolId: dto.schoolId, formKey: dto.formKey, userId },
    });
    if (draft) {
      draft.data = dto.data;
    } else {
      draft = this.formDraftRepo.create({
        schoolId: dto.schoolId,
        formKey: dto.formKey,
        userId,
        data: dto.data,
      });
    }
    return this.formDraftRepo.save(draft);
  }

  async clearFormDraft(
    schoolId: string,
    formKey: string,
    userId: string,
    roles: string[],
  ): Promise<{ success: boolean }> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    await this.formDraftRepo.delete({ schoolId, formKey, userId });
    return { success: true };
  }
}
