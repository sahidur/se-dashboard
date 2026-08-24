import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitoringSubmission } from './entities/monitoring-submission.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import {
  CreateMonitoringSubmissionDto,
  MonitoringAnswerDto,
  UpdateMonitoringSubmissionDto,
} from './dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class SchoolMonitoringService {
  /** Every "No / Not Satisfied" answer must be justified with at least this many characters. */
  private static readonly MIN_NEGATIVE_COMMENT_LENGTH = 50;

  constructor(
    @InjectRepository(MonitoringSubmission)
    private readonly submissionRepo: Repository<MonitoringSubmission>,
    @InjectRepository(DcSchool)
    private readonly schoolRepo: Repository<DcSchool>,
    private readonly usersService: UsersService,
  ) {}

  // ===================== Access helpers =====================

  private isAdminRole(roles: string[]): boolean {
    return roles.includes('Super Admin') || roles.includes('Admin');
  }

  private async getAssignedSchoolIds(userId: string): Promise<string[]> {
    const assigned = await this.usersService.getSchools(userId);
    return assigned.map((s) => s.id);
  }

  /** Every school id the user may observe: assigned + self-created. Admins → null (all). */
  private async getAccessibleSchoolIds(
    userId: string,
    roles: string[],
  ): Promise<string[] | null> {
    if (this.isAdminRole(roles)) return null;
    const assigned = await this.getAssignedSchoolIds(userId);
    const created = await this.schoolRepo.find({
      where: { createdById: userId },
      select: { id: true },
    });
    return Array.from(new Set([...assigned, ...created.map((s) => s.id)]));
  }

  private async validateSchoolAccess(
    schoolId: string,
    userId: string,
    roles: string[],
  ): Promise<DcSchool> {
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
   * Whether the user may edit/delete a monitoring submission (theirs or
   * anyone else's). Submissions are immutable to their author by design —
   * only Admins or roles granted `school-monitoring-edit` may modify/remove.
   */
  private async canEdit(userId: string, roles: string[]): Promise<boolean> {
    if (this.isAdminRole(roles)) return true;
    const fullUser = await this.usersService.findOneById(userId);
    const permissions =
      fullUser?.roles?.flatMap((r) => r.permissions || []) ?? [];
    return permissions.some((p) => p.module === 'school-monitoring-edit');
  }

  private async assertCanEdit(userId: string, roles: string[]): Promise<void> {
    if (!(await this.canEdit(userId, roles))) {
      throw new ForbiddenException(
        'Submitted monitoring feedback cannot be edited or deleted. Ask an administrator to grant the "Edit/Delete Monitoring" permission in Role Management.',
      );
    }
  }

  private assertNegativeAnswersExplained(answers?: MonitoringAnswerDto[]): void {
    const min = SchoolMonitoringService.MIN_NEGATIVE_COMMENT_LENGTH;
    const missing = (answers ?? [])
      .filter(
        (a) => a.result === 'no' && (a.comment?.trim().length ?? 0) < min,
      )
      .map((a) => a.code);
    if (missing.length) {
      throw new BadRequestException(
        `Every "No / Not Satisfied" answer needs a comment of at least ${min} characters. Please explain: ${missing.join(', ')}`,
      );
    }
  }

  // ===================== CRUD =====================

  async create(
    dto: CreateMonitoringSubmissionDto,
    userId: string,
    roles: string[],
  ): Promise<MonitoringSubmission> {
    await this.validateSchoolAccess(dto.schoolId, userId, roles);
    this.assertNegativeAnswersExplained(dto.answers);
    const submission = this.submissionRepo.create({
      schoolId: dto.schoolId,
      formType: dto.formType,
      observerName: dto.observerName ?? null,
      teacherName: dto.teacherName ?? null,
      observationDate: dto.observationDate ?? null,
      className: dto.className ?? null,
      answers: dto.answers ?? [],
      attachments: dto.attachments ?? [],
      generalRemarks: dto.generalRemarks ?? null,
      submittedById: userId,
    });
    return this.submissionRepo.save(submission);
  }

  /** Full history for a single school + form category, newest first. */
  async findForSchool(
    schoolId: string,
    userId: string,
    roles: string[],
    formType?: string,
  ): Promise<MonitoringSubmission[]> {
    await this.validateSchoolAccess(schoolId, userId, roles);
    const where: any = { schoolId };
    if (formType) where.formType = formType;
    return this.submissionRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /** Paginated browse across all schools the user may access. */
  async findAll(
    userId: string,
    roles: string[],
    filters: {
      schoolId?: string;
      formType?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: MonitoringSubmission[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.school', 'school')
      .leftJoinAndSelect('s.submittedBy', 'submittedBy')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const accessibleIds = await this.getAccessibleSchoolIds(userId, roles);
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      qb.andWhere('s.schoolId IN (:...ids)', { ids: accessibleIds });
    }

    if (filters.schoolId) {
      qb.andWhere('s.schoolId = :schoolId', { schoolId: filters.schoolId });
    }
    if (filters.formType) {
      qb.andWhere('s.formType = :formType', { formType: filters.formType });
    }
    if (filters.search) {
      qb.andWhere(
        '(school.name ILIKE :q OR s.observerName ILIKE :q OR s.teacherName ILIKE :q OR s.generalRemarks ILIKE :q)',
        { q: `%${filters.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    id: string,
    userId: string,
    roles: string[],
  ): Promise<MonitoringSubmission> {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: { school: true, submittedBy: true },
    });
    if (!submission) {
      throw new NotFoundException('Monitoring submission not found');
    }
    await this.validateSchoolAccess(submission.schoolId, userId, roles);
    return submission;
  }

  async update(
    id: string,
    dto: UpdateMonitoringSubmissionDto,
    userId: string,
    roles: string[],
  ): Promise<MonitoringSubmission> {
    const submission = await this.findOne(id, userId, roles);
    await this.assertCanEdit(userId, roles);
    this.assertNegativeAnswersExplained(dto.answers);
    Object.assign(submission, {
      observerName: dto.observerName ?? submission.observerName,
      teacherName: dto.teacherName ?? submission.teacherName,
      observationDate: dto.observationDate ?? submission.observationDate,
      className: dto.className ?? submission.className,
      answers: dto.answers ?? submission.answers,
      attachments: dto.attachments ?? submission.attachments,
      generalRemarks: dto.generalRemarks ?? submission.generalRemarks,
    });
    return this.submissionRepo.save(submission);
  }

  async remove(
    id: string,
    userId: string,
    roles: string[],
  ): Promise<{ success: boolean }> {
    const submission = await this.findOne(id, userId, roles);
    await this.assertCanEdit(userId, roles);
    await this.submissionRepo.softRemove(submission);
    return { success: true };
  }
}
