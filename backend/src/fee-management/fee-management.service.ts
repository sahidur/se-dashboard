import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, DataSource } from 'typeorm';
import { AcademicYear, AcademicYearStatus } from './entities/academic-year.entity';
import { FeeHead } from './entities/fee-head.entity';
import { FeeStructure } from './entities/fee-structure.entity';
import { StudentDiscount, DiscountType } from './entities/student-discount.entity';
import { SchoolClass } from '../students/entities/school-class.entity';
import { Student } from '../students/entities/student.entity';
import { FeeCollectionService } from '../fee-collection/fee-collection.service';
import { toMoney, isAdmissionRulesEnabled, MONTHS_IN_YEAR } from './fee-calculation';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  CreateFeeHeadDto,
  UpdateFeeHeadDto,
  SaveFeeStructureDto,
  CreateStudentDiscountDto,
  UpdateStudentDiscountDto,
} from './dto/fee-management.dto';

@Injectable()
export class FeeManagementService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly yearsRepo: Repository<AcademicYear>,
    @InjectRepository(FeeHead)
    private readonly headsRepo: Repository<FeeHead>,
    @InjectRepository(FeeStructure)
    private readonly structuresRepo: Repository<FeeStructure>,
    @InjectRepository(StudentDiscount)
    private readonly discountsRepo: Repository<StudentDiscount>,
    private readonly dataSource: DataSource,
    private readonly feeCollection: FeeCollectionService,
  ) {}

  // ---------- Academic Years ----------

  async createAcademicYear(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    const existing = await this.yearsRepo.findOne({
      where: { name: dto.name },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        existing.deletedAt
          ? `Academic year "${dto.name}" already exists (in the recycle bin)`
          : `Academic year "${dto.name}" already exists`,
      );
    }
    return this.yearsRepo.save(this.yearsRepo.create(dto));
  }

  findAcademicYears(activeOnly = false): Promise<AcademicYear[]> {
    return this.yearsRepo.find({
      where: activeOnly
        ? { status: AcademicYearStatus.ACTIVE, deletedAt: IsNull() }
        : undefined,
      order: { name: 'DESC' },
    });
  }

  async findActiveAcademicYear(): Promise<AcademicYear> {
    const year = await this.yearsRepo.findOne({
      where: { status: AcademicYearStatus.ACTIVE },
    });
    if (!year) throw new NotFoundException('No active academic year configured');
    return year;
  }

  async updateAcademicYear(
    id: string,
    dto: UpdateAcademicYearDto,
  ): Promise<AcademicYear> {
    const year = await this.yearsRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (dto.name && dto.name !== year.name) {
      const duplicate = await this.yearsRepo
        .createQueryBuilder('y')
        .where('y.id != :id', { id })
        .andWhere('y.name = :name', { name: dto.name })
        .withDeleted()
        .getOne();
      if (duplicate) {
        throw new ConflictException(`Academic year "${dto.name}" already exists`);
      }
    }
    Object.assign(year, dto);
    return this.yearsRepo.save(year);
  }

  async removeAcademicYear(id: string): Promise<void> {
    const year = await this.yearsRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    const feeCount = await this.structuresRepo.count({
      where: { academicYearId: id },
      withDeleted: false,
    });
    if (feeCount > 0) {
      throw new ConflictException(
        'Academic year has fee structures. Close it instead of deleting.',
      );
    }
    await this.yearsRepo.softRemove(year);
  }

  // ---------- Fee Heads ----------

  async createFeeHead(dto: CreateFeeHeadDto): Promise<FeeHead> {
    const duplicate = await this.headsRepo.findOne({
      where: {
        name: dto.name,
        category: dto.category ?? IsNull(),
      },
      withDeleted: true,
    });
    if (duplicate && !duplicate.deletedAt) {
      throw new ConflictException(
        `Fee head "${dto.name}" already exists in this category`,
      );
    }
    return this.headsRepo.save(this.headsRepo.create(dto));
  }

  findFeeHeads(activeOnly = false): Promise<FeeHead[]> {
    return this.headsRepo.find({
      where: activeOnly ? { isActive: true, deletedAt: IsNull() } : undefined,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async updateFeeHead(id: string, dto: UpdateFeeHeadDto): Promise<FeeHead> {
    const head = await this.headsRepo.findOne({ where: { id } });
    if (!head) throw new NotFoundException('Fee head not found');
    const nextName = dto.name ?? head.name;
    const nextCategory = dto.category ?? head.category;
    const duplicate = await this.headsRepo
      .createQueryBuilder('h')
      .where('h.id != :id', { id })
      .andWhere('LOWER(h.name) = LOWER(:name)', { name: nextName })
      .andWhere(
        nextCategory
          ? 'h.category = :category'
          : 'h.category IS NULL',
        nextCategory ? { category: nextCategory } : {},
      )
      .getOne();
    if (duplicate) {
      throw new ConflictException(
        `Fee head "${nextName}" already exists in this category`,
      );
    }
    Object.assign(head, dto);
    return this.headsRepo.save(head);
  }

  async removeFeeHead(id: string): Promise<void> {
    const head = await this.headsRepo.findOne({ where: { id } });
    if (!head) throw new NotFoundException('Fee head not found');
    const inUse = await this.structuresRepo.count({
      where: { feeHeadId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Fee head is used by fee structures. Deactivate it instead of deleting.',
      );
    }
    await this.headsRepo.softRemove(head);
  }

  // ---------- Fee Structure ----------

  // Saves the standard fee grid for one class + month: creates new rows,
  // updates changed amounts, removes rows whose amount became 0/removed.
  async saveFeeStructure(dto: SaveFeeStructureDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const schoolClass = await manager.findOne(SchoolClass, { where: { id: dto.classId, schoolId: dto.schoolId } });
      if (!schoolClass) throw new BadRequestException('Class does not belong to the selected school');
      const headIds = dto.lines.map((l) => l.feeHeadId);
      const heads = await manager.find(FeeHead, { where: { id: In(headIds) } });
      if (heads.length !== new Set(headIds).size) {
        throw new BadRequestException('One or more fee heads not found');
      }

      const existing = await manager.find(FeeStructure, {
        where: {
          schoolId: dto.schoolId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          month: dto.month,
        },
      });

      const toSave: FeeStructure[] = [];
      const seen = new Set<string>();

      for (const line of dto.lines) {
        if (line.amount < 0) {
          throw new BadRequestException('Fee amount cannot be negative');
        }
        if (line.amount === 0) continue; // zero amount = head not charged this month
        seen.add(line.feeHeadId);
        const current = existing.find((e) => e.feeHeadId === line.feeHeadId);
        if (current) {
          if (toMoney(parseFloat(current.amount)) !== toMoney(line.amount)) {
            current.amount = toMoney(line.amount).toFixed(2);
            toSave.push(current);
          }
        } else {
          toSave.push(
            manager.create(FeeStructure, {
              schoolId: dto.schoolId,
              academicYearId: dto.academicYearId,
              classId: dto.classId,
              month: dto.month,
              feeHeadId: line.feeHeadId,
              amount: toMoney(line.amount).toFixed(2),
              createdById: userId,
            }),
          );
        }
      }

      // Rows whose head is no longer charged (or amount set to 0) are removed
      const toRemove = existing.filter((e) => !seen.has(e.feeHeadId));

      if (toSave.length) await manager.save(toSave);
      if (toRemove.length) await manager.remove(toRemove);

      // The structure changed → re-apply the unpaid snapshots of this
      // class/month against it (paid months stay untouched), so Monthly
      // Collection follows the grid without a manual regenerate.
      if (toSave.length || toRemove.length) {
        await this.feeCollection.recalculateFeesWith(manager, {
          schoolId: dto.schoolId,
          academicYearId: dto.academicYearId,
          month: dto.month,
          classId: dto.classId,
        });

        // One-time annual heads (January-only amounts, yearly, half-yearly)
        // are also charged as a catch-up in the first billable month of
        // students admitted later, so editing the grid can change unpaid dues
        // in OTHER months too.
        if (isAdmissionRulesEnabled()) {
          for (let month = 1; month <= MONTHS_IN_YEAR; month++) {
            if (month === dto.month) continue;
            await this.feeCollection.recalculateFeesWith(manager, {
              schoolId: dto.schoolId,
              academicYearId: dto.academicYearId,
              month,
              classId: dto.classId,
            });
          }
        }
      }

      return manager.find(FeeStructure, {
        where: {
          schoolId: dto.schoolId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          month: dto.month,
        },
        relations: ['feeHead'],
        order: { month: 'ASC' },
      });
    });
  }

  findFeeStructure(
    schoolId: string,
    academicYearId: string,
    classId: string,
    months?: number[],
  ): Promise<FeeStructure[]> {
    return this.structuresRepo.find({
      where: {
        schoolId,
        academicYearId,
        classId,
        ...(months && months.length ? { month: In(months) } : {}),
      },
      relations: ['feeHead'],
      order: { month: 'ASC' },
    });
  }

  // ---------- Student Discounts ----------

  async createStudentDiscount(
    dto: CreateStudentDiscountDto,
    userId: string,
  ): Promise<StudentDiscount> {
    const student = await this.dataSource.manager.findOne(Student, { where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    if (dto.type === DiscountType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
    if (!dto.isRecurring) {
      // Without an explicit range a "one-time" discount would silently apply
      // to every generated month of the year (the old 1..12 default).
      if (dto.effectiveFromMonth == null || dto.effectiveToMonth == null) {
        throw new BadRequestException(
          'Non-recurring discounts require an effective month range (from/to)',
        );
      }
      if (dto.effectiveFromMonth > dto.effectiveToMonth) {
        throw new BadRequestException('Invalid effective month range');
      }
    }
    if (dto.feeHeadId) {
      const head = await this.headsRepo.findOne({
        where: { id: dto.feeHeadId },
      });
      if (!head) throw new NotFoundException('Fee head not found');
      // A head-level discount only bites when the head is actually charged to
      // the student's class in this academic year. Identical head names exist
      // per category (brac_academy/primary/secondary) and picking the wrong
      // copy used to save fine yet apply to nothing — reject it instead.
      const inStructure = await this.dataSource.manager.findOne(FeeStructure, {
        where: {
          classId: student.classId,
          academicYearId: dto.academicYearId,
          feeHeadId: dto.feeHeadId,
        },
      });
      if (!inStructure) {
        throw new BadRequestException(
          `"${head.name}" is not charged to this student's class in the selected academic year — ` +
            'the discount would never apply. Add the head to the class fee structure or pick a head that is.',
        );
      }
    }
    // Save and re-apply the student's unpaid fee snapshots in ONE transaction,
    // so the discount is reflected in Monthly Collection immediately —
    // generated snapshots are otherwise never rewritten (generateFees skips
    // existing months), which used to leave the discount invisible there.
    return this.dataSource.transaction(async (manager) => {
      const discount = await manager.save(
        manager.create(StudentDiscount, {
          ...dto,
          value: dto.value.toFixed(2),
          isRecurring: dto.isRecurring ?? true,
          createdById: userId,
        }),
      );
      await this.feeCollection.recalculateStudentFees(dto.studentId, dto.academicYearId, manager);
      return discount;
    });
  }

  findStudentDiscounts(studentId: string): Promise<StudentDiscount[]> {
    return this.discountsRepo.find({
      where: { studentId },
      relations: ['feeHead', 'academicYear'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStudentDiscount(
    id: string,
    dto: UpdateStudentDiscountDto,
  ): Promise<StudentDiscount> {
    const discount = await this.discountsRepo.findOne({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    if ((dto.type ?? discount.type) === DiscountType.PERCENTAGE &&
        (dto.value ?? parseFloat(discount.value)) > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
    if (dto.feeHeadId) {
      const head = await this.headsRepo.findOne({ where: { id: dto.feeHeadId } });
      if (!head) throw new NotFoundException('Fee head not found');
      // Same structure check as on create — the student's class must actually
      // charge this head in the discount's academic year.
      const student = await this.dataSource.manager.findOne(Student, {
        where: { id: discount.studentId },
      });
      const inStructure = student?.classId
        ? await this.dataSource.manager.findOne(FeeStructure, {
            where: {
              classId: student.classId,
              academicYearId: discount.academicYearId,
              feeHeadId: dto.feeHeadId,
            },
          })
        : null;
      if (!inStructure) {
        throw new BadRequestException(
          `"${head.name}" is not charged to this student's class in the discount's academic year — ` +
            'the discount would never apply. Add the head to the class fee structure or pick a head that is.',
        );
      }
    }
    if (!(dto.isRecurring ?? discount.isRecurring)) {
      const from = dto.effectiveFromMonth ?? discount.effectiveFromMonth;
      const to = dto.effectiveToMonth ?? discount.effectiveToMonth;
      if (from == null || to == null) {
        throw new BadRequestException(
          'Non-recurring discounts require an effective month range (from/to)',
        );
      }
      if (from > to) {
        throw new BadRequestException('Invalid effective month range');
      }
    }
    return this.dataSource.transaction(async (manager) => {
      Object.assign(discount, dto);
      if (dto.value !== undefined) discount.value = dto.value.toFixed(2);
      const saved = await manager.save(discount);
      await this.feeCollection.recalculateStudentFees(
        saved.studentId,
        saved.academicYearId,
        manager,
      );
      return saved;
    });
  }

  async removeStudentDiscount(id: string): Promise<void> {
    const discount = await this.discountsRepo.findOne({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    await this.dataSource.transaction(async (manager) => {
      await manager.softRemove(discount);
      await this.feeCollection.recalculateStudentFees(
        discount.studentId,
        discount.academicYearId,
        manager,
      );
    });
  }
}
