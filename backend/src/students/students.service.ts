import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, EntityManager } from 'typeorm';
import { likeContains } from '../common/utils/like-utils';
import { Student, StudentStatus, StudentGender } from './entities/student.entity';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSection } from './entities/section.entity';
import {
  FeeReconcileService,
  ReconcileSummary,
  DropoutCutoffSummary,
} from '../fee-collection/fee-reconcile.service';
import { isAdmissionRulesEnabled, toDateOnly } from '../fee-management/fee-calculation';
import {
  CreateClassDto,
  UpdateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateStudentDto,
  UpdateStudentDto,
  PromoteStudentsDto,
  TransferStudentDto,
  ListStudentsQueryDto,
  BulkUploadStudentsDto,
} from './dto/student.dto';

export interface BulkRowResult {
  row: number;
  name: string;
  admissionNumber?: string;
  error: string;
}

interface BulkStudentFields {
  name: string;
  rollNumber?: number;
  gender?: StudentGender;
  dateOfBirth?: string;
  admissionDate?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  referenceNumber?: string;
  birthCertificateId?: string;
  religion?: string;
  studentType?: 'new' | 'existing';
}

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly classesRepo: Repository<SchoolClass>,
    @InjectRepository(SchoolSection)
    private readonly sectionsRepo: Repository<SchoolSection>,
    @Optional()
    private readonly feeReconcile?: FeeReconcileService,
  ) {}

  /**
   * Re-applies the admission-date fee rules to one student inside the caller's
   * transaction. No-op until FEE_ADMISSION_RULES=on.
   */
  private async reconcileFees(
    manager: EntityManager,
    studentId: string,
    userId?: string,
  ): Promise<ReconcileSummary | undefined> {
    if (!this.feeReconcile || !isAdmissionRulesEnabled()) return undefined;
    const result = await this.feeReconcile.reconcileStudent(
      studentId,
      { actorId: userId ?? null },
      manager,
    );
    return result.summary;
  }

  // ---------- Classes ----------

  async createClass(dto: CreateClassDto): Promise<SchoolClass> {
    const duplicate = await this.classesRepo.findOne({
      where: {
        schoolId: dto.schoolId,
        name: dto.name,
        deletedAt: IsNull(),
      },
      withDeleted: true,
    });
    if (duplicate && !duplicate.deletedAt) {
      throw new ConflictException(
        `Class "${dto.name}" already exists for this school`,
      );
    }
    return this.classesRepo.save(this.classesRepo.create(dto));
  }

  findClasses(schoolId: string, activeOnly = false): Promise<SchoolClass[]> {
    return this.classesRepo.find({
      where: {
        schoolId,
        ...(activeOnly ? { isActive: true, deletedAt: IsNull() } : {}),
      },
      relations: ['sections'],
      order: { sequence: 'ASC', name: 'ASC' },
    });
  }

  async updateClass(id: string, dto: UpdateClassDto): Promise<SchoolClass> {
    const schoolClass = await this.classesRepo.findOne({ where: { id } });
    if (!schoolClass) throw new NotFoundException('Class not found');
    Object.assign(schoolClass, dto);
    return this.classesRepo.save(schoolClass);
  }

  async removeClass(id: string): Promise<void> {
    const schoolClass = await this.classesRepo.findOne({ where: { id } });
    if (!schoolClass) throw new NotFoundException('Class not found');
    const inUse = await this.studentsRepo.count({
      where: { classId: id, deletedAt: IsNull() },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Class is assigned to ${inUse} student(s). Deactivate it instead of deleting.`,
      );
    }
    await this.classesRepo.softRemove(schoolClass);
  }

  // ---------- Sections ----------

  async createSection(dto: CreateSectionDto): Promise<SchoolSection> {
    const schoolClass = await this.classesRepo.findOne({
      where: { id: dto.classId },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    const duplicate = await this.sectionsRepo.findOne({
      where: { classId: dto.classId, name: dto.name, deletedAt: IsNull() },
    });
    if (duplicate) {
      throw new ConflictException(
        `Section "${dto.name}" already exists for this class`,
      );
    }
    return this.sectionsRepo.save(this.sectionsRepo.create(dto));
  }

  findSections(classId: string, activeOnly = false): Promise<SchoolSection[]> {
    return this.sectionsRepo.find({
      where: {
        classId,
        ...(activeOnly ? { isActive: true, deletedAt: IsNull() } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async updateSection(
    id: string,
    dto: UpdateSectionDto,
  ): Promise<SchoolSection> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    Object.assign(section, dto);
    return this.sectionsRepo.save(section);
  }

  async removeSection(id: string): Promise<void> {
    const section = await this.sectionsRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('Section not found');
    const inUse = await this.studentsRepo.count({
      where: { sectionId: id, deletedAt: IsNull() },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Section is assigned to ${inUse} student(s). Deactivate it instead of deleting.`,
      );
    }
    await this.sectionsRepo.softRemove(section);
  }

  // ---------- Students ----------

  private async admissionPrefix(
    schoolId: string,
    academicYearName: string,
  ): Promise<string> {
    const school = await this.studentsRepo.manager
      .getRepository('DcSchool')
      .findOne({ where: { id: schoolId } });
    const schoolCode: string = school?.['code'] ?? 'SCH';
    return `${schoolCode}-${academicYearName}-`;
  }

  private async maxAdmissionSequence(
    schoolId: string,
    prefix: string,
  ): Promise<number> {
    const rows = await this.studentsRepo
      .createQueryBuilder('s')
      .select('s.admission_number', 'adm')
      .where('s.school_id = :schoolId', { schoolId })
      .andWhere('s.admission_number LIKE :prefix', { prefix: `${prefix}%` })
      .withDeleted()
      .getRawMany();
    let max = 0;
    for (const row of rows) {
      const seq = parseInt(row.adm.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
    return max;
  }

  private async nextAdmissionNumber(
    schoolId: string,
    academicYearName: string,
  ): Promise<string> {
    const prefix = await this.admissionPrefix(schoolId, academicYearName);
    const max = await this.maxAdmissionSequence(schoolId, prefix);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  async createStudent(
    dto: CreateStudentDto,
    userId: string,
  ): Promise<Student> {
    if (dto.classId) {
      const schoolClass = await this.classesRepo.findOne({ where: { id: dto.classId, schoolId: dto.schoolId } });
      if (!schoolClass) throw new BadRequestException('Selected class does not belong to the selected school');
    }
    if (dto.sectionId) {
      if (!dto.classId) {
        throw new BadRequestException('Section requires a class');
      }
      const section = await this.sectionsRepo.findOne({
        where: { id: dto.sectionId },
      });
      if (!section || section.classId !== dto.classId) {
        throw new BadRequestException(
          'Selected section does not belong to the selected class',
        );
      }
    }

    let yearName = String(new Date().getFullYear());
    if (dto.academicYearId) {
      const year = await this.studentsRepo.manager
        .getRepository('AcademicYear')
        .findOne({ where: { id: dto.academicYearId } });
      if (year) yearName = year.name;
    }

    const admissionNumber = await this.nextAdmissionNumber(
      dto.schoolId,
      yearName,
    );

    if (dto.studentType && !dto.academicYearId) {
      throw new BadRequestException('Select an academic year to set the student type');
    }
    const { studentType, ...rest } = dto;

    return this.studentsRepo.manager.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Student, {
          ...rest,
          dateOfBirth: dto.dateOfBirth ?? undefined,
          admissionDate: dto.admissionDate ?? undefined,
          studentType: studentType ?? null,
          studentTypeAcademicYearId: studentType ? dto.academicYearId : null,
          admissionNumber,
          createdById: userId,
        }),
      );
      const feeReconcile = await this.reconcileFees(manager, saved.id, userId);
      return feeReconcile ? Object.assign(saved, { feeReconcile }) : saved;
    });
  }

  async listStudents(query: ListStudentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.studentsRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.schoolClass', 'schoolClass')
      .leftJoinAndSelect('student.section', 'section')
      .leftJoinAndSelect('student.academicYear', 'academicYear')
      .where('student.deleted_at IS NULL')
      .skip((page - 1) * limit)
      .take(limit)
      // Class lists read top-to-bottom by roll: 1, 2, 3… Students without a
      // roll go last (name-ordered); the id tiebreaker keeps pagination
      // stable when rolls repeat or are missing. NOTE: orderBy must use
      // PROPERTY names — with take/skip pagination TypeORM resolves them
      // against entity metadata for its DISTINCT wrapper; raw column names
      // crash it (empty student list).
      .orderBy('student.rollNumber', 'ASC', 'NULLS LAST')
      .addOrderBy('student.name', 'ASC')
      .addOrderBy('student.id', 'ASC');

    if (query.schoolId) qb.andWhere('student.school_id = :schoolId', { schoolId: query.schoolId });
    if (query.classId) qb.andWhere('student.class_id = :classId', { classId: query.classId });
    if (query.sectionId) qb.andWhere('student.section_id = :sectionId', { sectionId: query.sectionId });
    if (query.academicYearId) qb.andWhere('student.academic_year_id = :academicYearId', { academicYearId: query.academicYearId });
    if (query.status) qb.andWhere('student.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(student.name ILIKE :search OR student.guardian_name ILIKE :search OR student.guardian_phone ILIKE :search OR student.admission_number ILIKE :search OR student.reference_number ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findStudent(id: string): Promise<Student> {
    const student = await this.studentsRepo.findOne({
      where: { id },
      relations: ['school', 'schoolClass', 'section', 'academicYear'],
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async updateStudent(id: string, dto: UpdateStudentDto, userId?: string): Promise<Student> {
    const student = await this.findStudent(id);
    if (dto.classId) {
      const schoolClass = await this.classesRepo.findOne({ where: { id: dto.classId, schoolId: student.schoolId } });
      if (!schoolClass) throw new BadRequestException('Selected class does not belong to the selected school');
      if (!dto.sectionId && student.sectionId && dto.classId !== student.classId) {
        throw new BadRequestException('Select a section of the new class');
      }
    }
    if (dto.sectionId) {
      const classId = dto.classId ?? student.classId;
      const section = await this.sectionsRepo.findOne({
        where: { id: dto.sectionId },
      });
      if (!section || section.classId !== classId) {
        throw new BadRequestException(
          'Selected section does not belong to the selected class',
        );
      }
    }
    const before = {
      admissionDate: toDateOnly(student.admissionDate),
      classId: student.classId ?? null,
      academicYearId: student.academicYearId ?? null,
      status: student.status,
      statusDate: toDateOnly(student.statusDate),
      studentType: student.studentType ?? null,
      studentTypeAcademicYearId: student.studentTypeAcademicYearId ?? null,
    };

    const { studentType, ...rest } = dto;
    Object.assign(student, rest);

    this.normalizeStatusDetails(student, dto, before.status);
    // Explicit new/existing marker. It belongs to one academic year, so a
    // marker left over from an earlier year is history: it is never cleared
    // by a form that shows the field as blank for the current year.
    if (studentType !== undefined) {
      const effectiveYear = student.academicYearId ?? null;
      const stale =
        !!before.studentType && before.studentTypeAcademicYearId !== effectiveYear;
      if (studentType === null) {
        if (!stale) {
          student.studentType = null;
          student.studentTypeAcademicYearId = null;
        }
      } else {
        if (!effectiveYear) {
          throw new BadRequestException('Select an academic year to set the student type');
        }
        student.studentType = studentType;
        student.studentTypeAcademicYearId = effectiveYear;
      }
    }

    const feeRelevantChange =
      before.admissionDate !== toDateOnly(student.admissionDate) ||
      before.classId !== (student.classId ?? null) ||
      before.academicYearId !== (student.academicYearId ?? null) ||
      before.status !== student.status ||
      before.studentType !== (student.studentType ?? null) ||
      before.studentTypeAcademicYearId !== (student.studentTypeAcademicYearId ?? null);

    // Dropout date set / moved / withdrawn: months after it are cancelled (or
    // brought back). Independent of the admission-date rules flag.
    const dropoutChange =
      (before.status === StudentStatus.DROPOUT || student.status === StudentStatus.DROPOUT) &&
      (before.status !== student.status || before.statusDate !== toDateOnly(student.statusDate));

    const admissionRulesChange =
      feeRelevantChange && !!this.feeReconcile && isAdmissionRulesEnabled();

    if (!this.feeReconcile || (!dropoutChange && !admissionRulesChange)) {
      return this.studentsRepo.save(student);
    }
    // Admission date / type / class / year / dropout changed: recalculate the
    // student's dues in the same transaction so the two can never disagree.
    return this.studentsRepo.manager.transaction(async (manager) => {
      const saved = await manager.save(student);
      const dropoutFees = dropoutChange
        ? await this.feeReconcile!.applyDropoutCutoff(manager, id, { actorId: userId ?? null })
        : undefined;
      const feeReconcile = await this.reconcileFees(manager, id, userId);
      const extra: { feeReconcile?: ReconcileSummary; dropoutFees?: DropoutCutoffSummary } = {};
      if (feeReconcile) extra.feeReconcile = feeReconcile;
      if (dropoutFees) extra.dropoutFees = dropoutFees;
      return Object.assign(saved, extra);
    });
  }

  private static readonly STATUS_WITH_DATE: Partial<Record<StudentStatus, string>> = {
    [StudentStatus.DROPOUT]: 'Dropout',
    [StudentStatus.TRANSFERRED]: 'Transfer',
    [StudentStatus.WITHDRAWN]: 'Withdrawal',
    [StudentStatus.GRADUATED]: 'Graduation',
  };

  /**
   * Dropout / transferred / withdrawn / graduated carry a date and a comment;
   * other statuses carry neither. Changing the status never inherits the
   * previous status's date or comment.
   */
  private normalizeStatusDetails(
    student: Student,
    dto: UpdateStudentDto,
    previousStatus: StudentStatus,
  ): void {
    const label = StudentsService.STATUS_WITH_DATE[student.status];
    if (!label) {
      student.statusDate = null;
      student.statusComment = null;
      return;
    }
    const statusChanged = previousStatus !== student.status;
    if (statusChanged) {
      if (dto.statusDate === undefined) student.statusDate = null;
      if (dto.statusComment === undefined) student.statusComment = null;
    }
    const date = toDateOnly(student.statusDate);
    if (statusChanged && !date) {
      throw new BadRequestException(`${label} date is required`);
    }
    const admission = toDateOnly(student.admissionDate);
    if (date && admission && date < admission) {
      throw new BadRequestException(`${label} date cannot be before the admission date`);
    }
    const comment = (student.statusComment ?? '').trim();
    student.statusComment = comment ? comment : null;
  }

  async removeStudent(id: string): Promise<void> {
    const student = await this.findStudent(id);
    // Students with financial history must not be hard-deleted; the whole
    // entity is soft-deleted here, keeping all payments/fees intact.
    await this.studentsRepo.softRemove(student);
  }

  // ---------- Promotion / Transfer ----------

  async promote(dto: PromoteStudentsDto, userId?: string): Promise<Student[]> {
    if (dto.studentIds.length === 0) {
      throw new BadRequestException('No students selected');
    }
    const targetClass = await this.classesRepo.findOne({
      where: { id: dto.targetClassId },
    });
    if (!targetClass) throw new NotFoundException('Target class not found');
    const targetSection = await this.sectionsRepo.findOne({
      where: { id: dto.targetSectionId },
    });
    if (!targetSection || targetSection.classId !== dto.targetClassId) {
      throw new BadRequestException(
        'Target section does not belong to the target class',
      );
    }

    const students = await this.studentsRepo.find({
      where: { id: In(dto.studentIds), deletedAt: IsNull() },
    });
    if (students.length !== new Set(dto.studentIds).size) {
      throw new NotFoundException('One or more students not found');
    }
    if (students.some((student) => student.schoolId !== targetClass.schoolId)) {
      throw new BadRequestException('Students must belong to the target class school');
    }

    for (const student of students) {
      student.classId = dto.targetClassId;
      student.sectionId = dto.targetSectionId;
      student.academicYearId = dto.targetAcademicYearId;
      student.status = StudentStatus.ACTIVE;
    }
    if (!this.feeReconcile || !isAdmissionRulesEnabled()) {
      return this.studentsRepo.save(students);
    }
    return this.studentsRepo.manager.transaction(async (manager) => {
      const saved = await manager.save(students);
      for (const s of saved) await this.reconcileFees(manager, s.id, userId);
      return saved;
    });
  }

  async transfer(id: string, dto: TransferStudentDto): Promise<Student> {
    const student = await this.findStudent(id);
    if (dto.targetSchoolId === student.schoolId) {
      throw new BadRequestException(
        'Target school must be different from the current school',
      );
    }
    if (dto.targetClassId) {
      const targetClass = await this.classesRepo.findOne({ where: { id: dto.targetClassId, schoolId: dto.targetSchoolId } });
      if (!targetClass) throw new BadRequestException('Target class does not belong to the target school');
    }
    if (dto.targetSectionId) {
      if (!dto.targetClassId) throw new BadRequestException('Target section requires a target class');
      const section = await this.sectionsRepo.findOne({ where: { id: dto.targetSectionId, classId: dto.targetClassId } });
      if (!section) throw new BadRequestException('Target section does not belong to the target class');
    }
    // Fee/payment history stays attached to the student row; class/section
    // snapshots inside student_fees preserve the old financial records.
    Object.assign(student, {
      schoolId: dto.targetSchoolId,
      classId: dto.targetClassId ?? null,
      sectionId: dto.targetSectionId ?? null,
    });
    if (dto.targetAcademicYearId) {
      student.academicYearId = dto.targetAcademicYearId;
    }
    student.status = StudentStatus.TRANSFERRED;
    // This endpoint has no date/comment input: the transfer happens today.
    student.statusDate = new Date();
    student.statusComment = null;
    return this.studentsRepo.save(student);
  }

  // ---------- Bulk upload ----------

  private normalizeGender(raw: string): StudentGender | null {
    const value = raw.trim().toLowerCase();
    if (!value) return null;
    if (['male', 'm', 'boy'].includes(value)) return StudentGender.MALE;
    if (['female', 'f', 'girl'].includes(value)) return StudentGender.FEMALE;
    if (['other'].includes(value)) return StudentGender.OTHER;
    return null;
  }

  private normalizeDate(raw: string): string | null {
    const value = raw.trim();
    if (!value) return null;
    const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }
    // Excel serial date (a plain number, e.g. 45005)
    const serial = value.match(/^\d{5}(?:\.\d+)?$/);
    if (serial) {
      const date = new Date(Math.round((Number(value) - 25569) * 86400000));
      if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    // DD/MM/YYYY or DD-MM-YYYY (spreadsheet exports in this region)
    const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    return null;
  }

  async bulkUploadStudents(
    dto: BulkUploadStudentsDto,
    userId: string,
  ): Promise<{ total: number; inserted: number; failed: BulkRowResult[]; errors: BulkRowResult[] }> {
    const school = await this.studentsRepo.manager
      .getRepository('DcSchool')
      .findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    if (dto.classId) {
      const schoolClass = await this.classesRepo.findOne({
        where: { id: dto.classId, schoolId: dto.schoolId },
      });
      if (!schoolClass) {
        throw new BadRequestException('Selected class does not belong to the selected school');
      }
    }
    if (dto.sectionId) {
      if (!dto.classId) throw new BadRequestException('Section requires a class');
      const section = await this.sectionsRepo.findOne({
        where: { id: dto.sectionId },
      });
      if (!section || section.classId !== dto.classId) {
        throw new BadRequestException('Selected section does not belong to the selected class');
      }
    }

    let yearName = String(new Date().getFullYear());
    if (dto.academicYearId) {
      const year = await this.studentsRepo.manager
        .getRepository('AcademicYear')
        .findOne({ where: { id: dto.academicYearId } });
      if (!year) throw new NotFoundException('Academic year not found');
      yearName = year.name;
    }

    // Validate every row first; if anything is invalid, nothing is imported
    // and the caller gets the full per-row error list to fix and re-upload.
    const errors: BulkRowResult[] = [];
    const rows: { row: number; entity: BulkStudentFields }[] = [];

    dto.students.forEach((row, index) => {
      // +2: spreadsheet rows are 1-based and row 1 is the header
      const rowNo = index + 2;
      const fail = (error: string) => {
        errors.push({ row: rowNo, name: (row.name ?? '').trim(), error });
      };
      const name = (row.name ?? '').trim();
      if (!name) {
        fail('Name is required');
        return;
      }

      const entity: BulkStudentFields = { name };

      if (row.rollNumber != null && String(row.rollNumber).trim() !== '') {
        const roll = parseInt(String(row.rollNumber).trim(), 10);
        if (isNaN(roll) || roll < 1) {
          fail('Roll number must be a positive whole number');
          return;
        }
        entity.rollNumber = roll;
      }

      if (row.gender != null && row.gender.trim() !== '') {
        const gender = this.normalizeGender(row.gender);
        if (!gender) {
          fail(`Unknown gender "${row.gender.trim()}" — use Male, Female or Other`);
          return;
        }
        entity.gender = gender;
      }

      for (const [key, label] of [
        ['dateOfBirth', 'Date of birth'],
        ['admissionDate', 'Admission date'],
      ] as const) {
        const raw = row[key];
        if (raw != null && String(raw).trim() !== '') {
          const iso = this.normalizeDate(String(raw));
          if (!iso) {
            fail(`${label} is not a valid date — use YYYY-MM-DD, DD/MM/YYYY or a date cell`);
            return;
          }
          entity[key] = iso;
        }
      }

      for (const key of [
        'guardianName',
        'guardianPhone',
        'address',
        'referenceNumber',
        'birthCertificateId',
        'religion',
      ] as const) {
        const raw = row[key];
        if (raw != null && String(raw).trim() !== '') {
          entity[key] = String(raw).trim();
        }
      }

      if (row.studentType != null && String(row.studentType).trim() !== '') {
        const value = String(row.studentType).trim().toLowerCase();
        if (['new', 'n'].includes(value)) entity.studentType = 'new';
        else if (['existing', 'old', 'o', 'e'].includes(value)) entity.studentType = 'existing';
        else {
          fail(`Unknown student type "${String(row.studentType).trim()}" — use New or Old (or leave blank)`);
          return;
        }
        if (!dto.academicYearId) {
          fail('Student type needs an academic year selected for the import');
          return;
        }
      }

      rows.push({ row: rowNo, entity });
    });

    if (errors.length > 0) {
      return { total: dto.students.length, inserted: 0, failed: [], errors };
    }

    const prefix = await this.admissionPrefix(dto.schoolId, yearName);
    let sequence = await this.maxAdmissionSequence(dto.schoolId, prefix);
    const numbered = rows.map(({ row, entity }) => {
      sequence += 1;
      const admissionNumber = `${prefix}${String(sequence).padStart(4, '0')}`;
      const student = this.studentsRepo.create({
        ...entity,
        schoolId: dto.schoolId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        status: StudentStatus.ACTIVE,
        admissionNumber,
        studentTypeAcademicYearId: entity.studentType ? dto.academicYearId : undefined,
        createdById: userId,
      });
      return { row, student };
    });

    // Fast path: batched inserts. If a batch fails (e.g. a concurrent request
    // grabbed an admission number), fall back to row-by-row so only the
    // genuinely broken rows are reported.
    const failed: BulkRowResult[] = [];
    let inserted = 0;
    const CHUNK_SIZE = 200;
    for (let i = 0; i < numbered.length; i += CHUNK_SIZE) {
      const chunk = numbered.slice(i, i + CHUNK_SIZE);
      try {
        await this.studentsRepo.insert(chunk.map((c) => c.student));
        inserted += chunk.length;
      } catch {
        for (const { row, student } of chunk) {
          try {
            await this.studentsRepo.insert(student);
            inserted += 1;
          } catch {
            failed.push({
              row,
              name: student.name,
              admissionNumber: student.admissionNumber,
              error: `Could not save (admission number ${student.admissionNumber} may conflict) — retry this row`,
            });
          }
        }
      }
    }

    // Late admissions get the months their class already has. Failures here
    // must not undo an import that is already committed - they are logged and
    // the dues can be re-applied per student.
    if (inserted > 0 && this.feeReconcile && isAdmissionRulesEnabled()) {
      const saved = await this.studentsRepo.find({
        where: {
          schoolId: dto.schoolId,
          admissionNumber: In(numbered.map((n) => n.student.admissionNumber)),
        },
        select: ['id'],
      });
      for (const s of saved) {
        try {
          await this.feeReconcile.reconcileStudent(s.id, { actorId: userId });
        } catch (error) {
          this.logger.warn(
            `Fee reconcile after bulk upload failed for student ${s.id}: ${(error as Error)?.message ?? error}`,
          );
        }
      }
    }

    return { total: dto.students.length, inserted, failed, errors: [] };
  }
}
