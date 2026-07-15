import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
import { DcActivityParticipation } from './entities/dc-activity-participation.entity';
import { DcEventParticipation } from './entities/dc-event-participation.entity';
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
  UpsertPedagogicalAchievementDto,
  UpsertCocurricularDto,
  UpsertStudentsPerformanceDto,
  UpsertActivityParticipationDto,
  CreateEventParticipationDto,
  UpdateEventParticipationDto,
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
    @InjectRepository(DcActivityParticipation) private activityPartRepo: Repository<DcActivityParticipation>,
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

  /** @deprecated use validateSchoolAccess */
  private async validateSchoolOwnership(schoolId: string, userId: string): Promise<DcSchool> {
    return this.validateSchoolAccess(schoolId, userId, []);
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
    const [basicInfo, infra, studentsCount, teacherIndividualCount, teachersDevCount, revenue, feeStructureCount, revBudgetTotal, revBudgetMonthlyCount, revActualTotal, revActualMonthlyCount, performance, alumni, pedagAchievCount, cocurricularCount, studentsPerfCount, activityPartCount, eventPartCount] =
      await Promise.all([
        this.basicInfoRepo.findOne({ where: { schoolId } }),
        this.infraRepo.findOne({ where: { schoolId } }),
        this.studentsRepo.count({ where: { schoolId } }),
        this.teacherIndividualRepo.count({ where: { schoolId } }),
        this.teachersDevRepo.count({ where: { schoolId } }),
        this.revenueRepo.findOne({ where: { schoolId } }),
        this.feeStructureRepo.count({ where: { schoolId } }),
        this.revBudgetTotalRepo.findOne({ where: { schoolId } }),
        this.revBudgetMonthlyRepo.count({ where: { schoolId } }),
        this.revActualTotalRepo.findOne({ where: { schoolId } }),
        this.revActualMonthlyRepo.count({ where: { schoolId } }),
        this.performanceRepo.findOne({ where: { schoolId } }),
        this.alumniRepo.find({ where: { schoolId } }),
        this.pedagAchievRepo.count({ where: { schoolId } }),
        this.cocurricularRepo.count({ where: { schoolId } }),
        this.studentsPerfRepo.count({ where: { schoolId } }),
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
        studentsInfo: { submitted: studentsCount >= 84, count: studentsCount },
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
        activityParticipation: { submitted: activityPartCount > 0, count: activityPartCount },
        eventParticipation: { submitted: eventPartCount > 0, count: eventPartCount },
      },
    };
  }

  // ===================== Basic Information =====================

  async upsertBasicInfo(dto: UpsertBasicInfoDto, userId: string): Promise<DcBasicInfo> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.basicInfoRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.basicInfoRepo.create({ ...dto, createdById: userId });
    }
    return this.basicInfoRepo.save(record);
  }

  async getBasicInfo(schoolId: string, userId: string): Promise<DcBasicInfo | null> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.basicInfoRepo.findOne({ where: { schoolId } });
  }

  // ===================== Infrastructure =====================

  async upsertInfrastructure(dto: UpsertInfrastructureDto, userId: string): Promise<DcInfrastructure> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.infraRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.infraRepo.create({ ...dto, createdById: userId });
    }
    return this.infraRepo.save(record);
  }

  async getInfrastructure(schoolId: string, userId: string): Promise<DcInfrastructure | null> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.infraRepo.findOne({ where: { schoolId } });
  }

  // ===================== Students Info =====================

  async upsertStudentsInfo(dto: UpsertStudentsInfoDto, userId: string): Promise<DcStudentsInfo> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.studentsRepo.findOne({
      where: { schoolId: dto.schoolId, month: dto.month, grade: dto.grade },
    });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.studentsRepo.create({ ...dto, createdById: userId });
    }
    return this.studentsRepo.save(record);
  }

  async getStudentsInfo(schoolId: string, userId: string): Promise<DcStudentsInfo[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    // Fetch all, sort in JS by chronological month then grade
    const MONTH_ORDER = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];
    const GRADE_ORDER = ['play_learn','nursery','g1','g2','g3','g4','g5'];
    const records = await this.studentsRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
    });
    return records.sort((a, b) => {
      const mDiff = MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
      if (mDiff !== 0) return mDiff;
      return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
    });
  }

  // ===================== Teachers Info =====================

  async upsertTeachersInfo(dto: UpsertTeachersInfoDto, userId: string): Promise<DcTeachersInfo> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.teachersRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.teachersRepo.create({ ...dto, createdById: userId });
    }
    return this.teachersRepo.save(record);
  }

  async getTeachersInfo(schoolId: string, userId: string): Promise<DcTeachersInfo | null> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.teachersRepo.findOne({ where: { schoolId } });
  }

  // ===================== Teacher Individual (multi-entry) =====================

  async createTeacherIndividual(dto: CreateTeacherIndividualDto, userId: string): Promise<DcTeacherIndividual> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    const record = this.teacherIndividualRepo.create({ ...dto, createdById: userId });
    return this.teacherIndividualRepo.save(record);
  }

  async getTeacherIndividuals(schoolId: string, userId: string): Promise<DcTeacherIndividual[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.teacherIndividualRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteTeacherIndividual(id: string, userId: string): Promise<void> {
    const record = await this.teacherIndividualRepo.findOne({
      where: { id },
      relations: { school: true },
    });
    if (!record) throw new NotFoundException('Teacher record not found');
    await this.validateSchoolOwnership(record.schoolId, userId);
    await this.teacherIndividualRepo.remove(record);
  }

  // ===================== Teachers Development (per month) =====================

  async upsertTeachersDevelopment(dto: UpsertTeachersDevelopmentDto, userId: string): Promise<DcTeachersDevelopment> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.teachersDevRepo.findOne({
      where: { schoolId: dto.schoolId, month: dto.month },
    });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.teachersDevRepo.create({ ...dto, createdById: userId });
    }
    return this.teachersDevRepo.save(record);
  }

  async getTeachersDevelopment(schoolId: string, userId: string): Promise<DcTeachersDevelopment[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    const MONTH_ORDER = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];
    const records = await this.teachersDevRepo.find({
      where: { schoolId },
      relations: { createdBy: true },
    });
    return records.sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
  }

  // ===================== Revenue =====================

  async upsertRevenue(dto: UpsertRevenueDto, userId: string): Promise<DcRevenue> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.revenueRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.revenueRepo.create({ ...dto, createdById: userId });
    }
    return this.revenueRepo.save(record);
  }

  async getRevenue(schoolId: string, userId: string): Promise<DcRevenue | null> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.revenueRepo.findOne({ where: { schoolId } });
  }

  // ===================== Performance =====================

  async upsertPerformance(dto: UpsertPerformanceDto, userId: string): Promise<DcPerformance> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.performanceRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.performanceRepo.create({ ...dto, createdById: userId });
    }
    return this.performanceRepo.save(record);
  }

  async getPerformance(schoolId: string, userId: string): Promise<DcPerformance | null> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.performanceRepo.findOne({ where: { schoolId } });
  }

  // ===================== Alumni =====================

  async createAlumni(dto: CreateAlumniDto, userId: string): Promise<DcAlumni> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    const record = this.alumniRepo.create({ ...dto, createdById: userId });
    return this.alumniRepo.save(record);
  }

  async getAlumniBySchool(schoolId: string, userId: string): Promise<DcAlumni[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.alumniRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' } });
  }

  async updateAlumni(id: string, dto: UpdateAlumniDto, userId: string): Promise<DcAlumni> {
    const record = await this.alumniRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Alumni record not found');
    await this.validateSchoolOwnership(record.schoolId, userId);
    Object.assign(record, dto);
    return this.alumniRepo.save(record);
  }

  async deleteAlumni(id: string, userId: string): Promise<void> {
    const record = await this.alumniRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Alumni record not found');
    await this.validateSchoolOwnership(record.schoolId, userId);
    await this.alumniRepo.remove(record);
  }

  // ===================== Fee Structure =====================

  async upsertFeeStructure(dto: UpsertFeeStructureDto, userId: string, roles: string[]): Promise<DcFeeStructure> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.feeStructureRepo.findOne({
      where: { schoolId: dto.schoolId, month: dto.month, grade: dto.grade },
      relations: ['createdBy', 'updatedBy'],
    });
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
    return this.feeStructureRepo.find({
      where: { schoolId },
      relations: ['createdBy', 'updatedBy'],
      order: { month: 'ASC', grade: 'ASC' },
    });
  }

  async getFeeStructureLogs(schoolId: string, userId: string, roles: string[]): Promise<DcFeeStructureLog[]> {
    if (!this.isAdminRole(roles)) throw new NotFoundException('Access denied');
    return this.feeStructureLogRepo.find({
      where: { schoolId },
      relations: ['editedBy'],
      order: { editedAt: 'DESC' },
    });
  }

  // ===================== Revenue Budget Total =====================

  async upsertRevenueBudgetTotal(dto: UpsertRevenueBudgetTotalDto, userId: string, roles: string[]): Promise<DcRevenueBudgetTotal> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.revBudgetTotalRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto, { updatedById: userId });
    } else {
      record = this.revBudgetTotalRepo.create({ ...dto, createdById: userId });
    }
    return this.revBudgetTotalRepo.save(record);
  }

  async getRevenueBudgetTotal(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueBudgetTotal | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revBudgetTotalRepo.findOne({ where: { schoolId } });
  }

  // ===================== Revenue Budget Monthly =====================

  private calcPct(target: number, achievement: number): number {
    if (!target || target === 0) return 0;
    return Math.min(parseFloat(((achievement / target) * 100).toFixed(2)), 9999.99);
  }

  async upsertRevenueBudgetMonthly(dto: UpsertRevenueBudgetMonthlyDto, userId: string, roles: string[]): Promise<DcRevenueBudgetMonthly> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const collectionPct = this.calcPct(dto.tuitionFeeTarget ?? 0, dto.tuitionFeeAchievement ?? 0);
    let record = await this.revBudgetMonthlyRepo.findOne({ where: { schoolId: dto.schoolId, month: dto.month } });
    if (record) {
      Object.assign(record, dto, { collectionPct, updatedById: userId });
    } else {
      record = this.revBudgetMonthlyRepo.create({ ...dto, collectionPct, createdById: userId });
    }
    return this.revBudgetMonthlyRepo.save(record);
  }

  async getRevenueBudgetMonthly(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueBudgetMonthly[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revBudgetMonthlyRepo.find({ where: { schoolId }, order: { month: 'ASC' } });
  }

  // ===================== Revenue Actual Total =====================

  async upsertRevenueActualTotal(dto: UpsertRevenueActualTotalDto, userId: string, roles: string[]): Promise<DcRevenueActualTotal> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.revActualTotalRepo.findOne({ where: { schoolId: dto.schoolId } });
    if (record) {
      Object.assign(record, dto, { updatedById: userId });
    } else {
      record = this.revActualTotalRepo.create({ ...dto, createdById: userId });
    }
    return this.revActualTotalRepo.save(record);
  }

  async getRevenueActualTotal(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueActualTotal | null> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revActualTotalRepo.findOne({ where: { schoolId } });
  }

  // ===================== Revenue Actual Monthly =====================

  async upsertRevenueActualMonthly(dto: UpsertRevenueActualMonthlyDto, userId: string, roles: string[]): Promise<DcRevenueActualMonthly> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    const collectionPct = this.calcPct(dto.tuitionFeeTarget ?? 0, dto.tuitionFeeAchievement ?? 0);
    let record = await this.revActualMonthlyRepo.findOne({ where: { schoolId: dto.schoolId, month: dto.month } });
    if (record) {
      Object.assign(record, dto, { collectionPct, updatedById: userId });
    } else {
      record = this.revActualMonthlyRepo.create({ ...dto, collectionPct, createdById: userId });
    }
    return this.revActualMonthlyRepo.save(record);
  }

  async getRevenueActualMonthly(schoolId: string, userId: string, roles: string[]): Promise<DcRevenueActualMonthly[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.revActualMonthlyRepo.find({ where: { schoolId }, order: { month: 'ASC' } });
  }

  // ===================== Pedagogical Achievements =====================

  async upsertPedagogicalAchievement(dto: UpsertPedagogicalAchievementDto, userId: string): Promise<DcPedagogicalAchievement> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.pedagAchievRepo.findOne({ where: { schoolId: dto.schoolId, year: dto.year } });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.pedagAchievRepo.create({ ...dto, createdById: userId });
    }
    return this.pedagAchievRepo.save(record);
  }

  async getPedagogicalAchievements(schoolId: string, userId: string): Promise<DcPedagogicalAchievement[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.pedagAchievRepo.find({ where: { schoolId }, order: { year: 'DESC' } });
  }

  async deletePedagogicalAchievement(id: string, userId: string): Promise<void> {
    const record = await this.pedagAchievRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolOwnership(record.schoolId, userId);
    await this.pedagAchievRepo.remove(record);
  }

  // ===================== Co-curricular =====================

  async upsertCocurricular(dto: UpsertCocurricularDto, userId: string): Promise<DcCocurricular> {
    await this.validateSchoolOwnership(dto.schoolId, userId);
    let record = await this.cocurricularRepo.findOne({
      where: { schoolId: dto.schoolId, month: dto.month, grade: dto.grade },
    });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.cocurricularRepo.create({ ...dto, createdById: userId });
    }
    return this.cocurricularRepo.save(record);
  }

  async getCocurricular(schoolId: string, userId: string): Promise<DcCocurricular[]> {
    await this.validateSchoolOwnership(schoolId, userId);
    return this.cocurricularRepo.find({ where: { schoolId }, order: { month: 'ASC', grade: 'ASC' } });
  }

  async deleteCocurricular(id: string, userId: string): Promise<void> {
    const record = await this.cocurricularRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolOwnership(record.schoolId, userId);
    await this.cocurricularRepo.remove(record);
  }

  // ===================== Students' Performance =====================

  async upsertStudentsPerformance(dto: UpsertStudentsPerformanceDto, userId: string, roles: string[]): Promise<DcStudentsPerformance> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.studentsPerfRepo.findOne({
      where: { schoolId: dto.schoolId, grade: dto.grade, examName: dto.examName },
    });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.studentsPerfRepo.create({ ...dto, createdById: userId });
    }
    return this.studentsPerfRepo.save(record);
  }

  async getStudentsPerformance(schoolId: string, userId: string, roles: string[]): Promise<DcStudentsPerformance[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.studentsPerfRepo.find({ where: { schoolId }, order: { grade: 'ASC', examName: 'ASC' } });
  }

  async deleteStudentsPerformance(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.studentsPerfRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.studentsPerfRepo.remove(record);
  }

  // ===================== Activity Participation (Corner/Club/Library/Lab) =====================

  async upsertActivityParticipation(dto: UpsertActivityParticipationDto, userId: string, roles: string[]): Promise<DcActivityParticipation> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    let record = await this.activityPartRepo.findOne({
      where: { schoolId: dto.schoolId, item: dto.item, month: dto.month, grade: dto.grade },
    });
    if (record) {
      Object.assign(record, dto);
    } else {
      record = this.activityPartRepo.create({ ...dto, createdById: userId });
    }
    return this.activityPartRepo.save(record);
  }

  async getActivityParticipation(schoolId: string, userId: string, roles: string[]): Promise<DcActivityParticipation[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    return this.activityPartRepo.find({ where: { schoolId }, order: { month: 'ASC', item: 'ASC', grade: 'ASC' } });
  }

  async deleteActivityParticipation(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.activityPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.activityPartRepo.remove(record);
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
    return this.eventPartRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' } });
  }

  async updateEventParticipation(id: string, dto: UpdateEventParticipationDto, userId: string, roles: string[]): Promise<DcEventParticipation> {
    const record = await this.eventPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Event participation record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    Object.assign(record, dto);
    record.totalAwarded = (record.maleAwarded || 0) + (record.femaleAwarded || 0) + (record.othersAwarded || 0);
    return this.eventPartRepo.save(record);
  }

  async deleteEventParticipation(id: string, userId: string, roles: string[]): Promise<void> {
    const record = await this.eventPartRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Event participation record not found');
    await this.validateSchoolAccess(record.schoolId, userId, roles);
    await this.eventPartRepo.remove(record);
  }

  // ===================== Programme Overview (aggregated) =====================

  async getProgrammeOverview(userId: string, roles: string[], category?: string) {
    const admin = this.isAdminRole(roles);
    const schoolWhere: any = admin ? {} : { createdById: userId };
    if (category) schoolWhere.schoolCategory = category;

    const schools = await this.schoolRepo.find({ where: schoolWhere });
    const schoolIds = schools.map((s) => s.id);

    if (schoolIds.length === 0) {
      return this.emptyOverview(schools);
    }

    // Parallel aggregate queries
    const [teacherRows, studentRows, budgetTotals, actualTotals] = await Promise.all([
      this.teacherIndividualRepo
        .createQueryBuilder('t')
        .select('t.school_id', 'schoolId')
        .addSelect('t.gender', 'gender')
        .addSelect('COUNT(*)', 'cnt')
        .where('t.school_id IN (:...ids)', { ids: schoolIds })
        .groupBy('t.school_id')
        .addGroupBy('t.gender')
        .getRawMany(),
      this.studentsRepo
        .createQueryBuilder('s')
        .select('s.school_id', 'schoolId')
        .addSelect('SUM(s.boys)', 'boys')
        .addSelect('SUM(s.girls)', 'girls')
        .addSelect('SUM(s.total)', 'total')
        .addSelect('SUM(s.persons_with_disability)', 'pwd')
        .addSelect('SUM(s.ethnic)', 'ethnic')
        .where('s.school_id IN (:...ids)', { ids: schoolIds })
        .groupBy('s.school_id')
        .getRawMany(),
      this.revBudgetTotalRepo.find({ where: schoolIds.map((id) => ({ schoolId: id })) }),
      this.revActualTotalRepo.find({ where: schoolIds.map((id) => ({ schoolId: id })) }),
    ]);

    // Aggregate teacher counts
    const teacherMap: Record<string, { male: number; female: number }> = {};
    for (const row of teacherRows) {
      if (!teacherMap[row.schoolId]) teacherMap[row.schoolId] = { male: 0, female: 0 };
      const g = (row.gender ?? '').toLowerCase();
      if (g === 'male') teacherMap[row.schoolId].male += parseInt(row.cnt, 10);
      else if (g === 'female') teacherMap[row.schoolId].female += parseInt(row.cnt, 10);
    }

    // Aggregate student counts
    const studentMap: Record<string, { boys: number; girls: number; total: number; pwd: number; ethnic: number }> = {};
    for (const row of studentRows) {
      studentMap[row.schoolId] = {
        boys: parseInt(row.boys ?? '0', 10),
        girls: parseInt(row.girls ?? '0', 10),
        total: parseInt(row.total ?? '0', 10),
        pwd: parseInt(row.pwd ?? '0', 10),
        ethnic: parseInt(row.ethnic ?? '0', 10),
      };
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

    return { totals, categories, schools: schoolRows };
  }

  private emptyOverview(schools: DcSchool[]) {
    return {
      totals: {
        totalSchools: 0, totalTeachersMale: 0, totalTeachersFemale: 0, totalTeachers: 0,
        totalStudentsBoys: 0, totalStudentsGirls: 0, totalStudents: 0, totalPWD: 0, totalEthnic: 0,
        yearlyStudentTarget: 0, budgetRevenueTarget: 0, budgetRevenueAchievement: 0,
        actualRevenueTarget: 0, actualRevenueAchievement: 0,
      },
      categories: {},
      schools: [],
    };
  }

  // ===================== School Profile Overview =====================

  async getSchoolProfile(schoolId: string, userId: string, roles: string[]) {
    const school = await this.validateSchoolAccess(schoolId, userId, roles);

    const [basicInfo, infra, teachers, studentRows, budgetTotal, actualTotal,
           alumni, pedagAchievements] = await Promise.all([
      this.basicInfoRepo.findOne({ where: { schoolId } }),
      this.infraRepo.findOne({ where: { schoolId } }),
      this.teacherIndividualRepo.find({ where: { schoolId } }),
      this.studentsRepo.find({ where: { schoolId } }),
      this.revBudgetTotalRepo.findOne({ where: { schoolId } }),
      this.revActualTotalRepo.findOne({ where: { schoolId } }),
      this.alumniRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' } }),
      this.pedagAchievRepo.find({ where: { schoolId }, order: { year: 'DESC' } }),
    ]);

    // Aggregate students by grade
    const byGrade: Record<string, { boys: number; girls: number; total: number; pwd: number; ethnic: number }> = {};
    let totalBoys = 0, totalGirls = 0, totalStudents = 0, totalPWD = 0, totalEthnic = 0;
    for (const row of studentRows) {
      if (!byGrade[row.grade]) byGrade[row.grade] = { boys: 0, girls: 0, total: 0, pwd: 0, ethnic: 0 };
      byGrade[row.grade].boys += row.boys;
      byGrade[row.grade].girls += row.girls;
      byGrade[row.grade].total += row.total;
      byGrade[row.grade].pwd += row.personsWithDisability;
      byGrade[row.grade].ethnic += row.ethnic;
      totalBoys += row.boys;
      totalGirls += row.girls;
      totalStudents += row.total;
      totalPWD += row.personsWithDisability;
      totalEthnic += row.ethnic;
    }

    const maleTeachers = teachers.filter((t) => t.gender === 'Male').length;
    const femaleTeachers = teachers.filter((t) => t.gender === 'Female').length;

    return {
      school,
      basicInfo,
      infrastructure: infra,
      teachers: {
        total: teachers.length,
        male: maleTeachers,
        female: femaleTeachers,
        list: teachers,
      },
      students: {
        total: totalStudents,
        boys: totalBoys,
        girls: totalGirls,
        pwd: totalPWD,
        ethnic: totalEthnic,
        byGrade,
      },
      revenue: {
        budgetTotal,
        actualTotal,
      },
      alumni,
      pedagogicalAchievements: pedagAchievements,
    };
  }
}
