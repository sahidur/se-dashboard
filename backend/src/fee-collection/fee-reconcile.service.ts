import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Student, StudentStatus } from '../students/entities/student.entity';
import { AcademicYear } from '../fee-management/entities/academic-year.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import { StudentDiscount } from '../fee-management/entities/student-discount.entity';
import { FeeHead, FeeApplicability, FeeSchedule } from '../fee-management/entities/fee-head.entity';
import { StudentFee, StudentFeeStatus } from './entities/student-fee.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import {
  FeeAdjustment,
  FeeAdjustmentStatus,
} from './entities/fee-adjustment.entity';
import {
  planStudentReconcile,
  PlannerFee,
  ReconcileAction,
  VOID_SOURCE_ADMISSION_DATE,
} from './fee-reconcile.planner';
import { ListFeeAdjustmentsQueryDto, ResolveFeeAdjustmentDto } from './dto/fee-collection.dto';

export interface ReconcileOptions {
  /** User performing the change (recorded on voided rows). */
  actorId?: string | null;
  /** Create missing months up to the class's latest generated month. Default true. */
  createMissing?: boolean;
  /**
   * Fee-head settings to assume instead of the stored ones (by head id). Lets
   * a preview show the result of head changes that have not been saved yet.
   */
  headOverrides?: Map<string, { applicableTo?: FeeApplicability; feeSchedule?: FeeSchedule }>;
}

export interface ReconcileSummary {
  voided: number;
  reinstated: number;
  rebuilt: number;
  adjusted: number;
  created: number;
  flagged: number;
  dismissed: number;
}

export interface ReconcileResult {
  studentId: string;
  summary: ReconcileSummary;
  actions: ReconcileAction[];
}

const emptySummary = (): ReconcileSummary => ({
  voided: 0,
  reinstated: 0,
  rebuilt: 0,
  adjusted: 0,
  created: 0,
  flagged: 0,
  dismissed: 0,
});

/**
 * Brings one student's fee rows in line with the admission-date rules:
 * voids dues before the admission month, reinstates them if the date moves
 * earlier, rebuilds unpaid months with the applicable heads, creates months
 * the class already has, and records review flags (never edits money).
 * Every write goes through manager.save so the audit subscriber logs it.
 */
@Injectable()
export class FeeReconcileService {
  private readonly logger = new Logger(FeeReconcileService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Reconciles inside the caller's transaction, or opens its own. */
  async reconcileStudent(
    studentId: string,
    opts: ReconcileOptions = {},
    manager?: EntityManager,
  ): Promise<ReconcileResult> {
    const run = (m: EntityManager) => this.reconcileStudentInManager(m, studentId, opts);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /** Runs the full reconciliation and rolls it back: shows what WOULD change. */
  async previewStudent(studentId: string, opts: ReconcileOptions = {}): Promise<ReconcileResult> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      return await this.reconcileStudentInManager(runner.manager, studentId, opts);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  }

  /** Student ids to process in a bulk run (optionally one school). */
  async listStudentIds(schoolId?: string): Promise<string[]> {
    const qb = this.dataSource
      .getRepository(Student)
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.deleted_at IS NULL')
      .orderBy('s.school_id')
      .addOrderBy('s.id');
    if (schoolId) qb.andWhere('s.school_id = :schoolId', { schoolId });
    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  async reconcileStudentInManager(
    manager: EntityManager,
    studentId: string,
    opts: ReconcileOptions = {},
  ): Promise<ReconcileResult> {
    const result: ReconcileResult = { studentId, summary: emptySummary(), actions: [] };

    // Serialise with other reconciles/updates of the same student.
    const student = await manager.findOne(Student, {
      where: { id: studentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!student) return result;

    // Same safeguard as discount recalculation: only the current school's
    // rows are ever touched after a cross-school transfer.
    // Locking the rows also serialises with collectPayment, which locks the
    // fee row before reading it - a payment can't slip in after our check.
    const feeEntities = await manager.find(StudentFee, {
      where: { studentId, schoolId: student.schoolId },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    });

    const yearIds = new Set(feeEntities.map((f) => f.academicYearId));
    if (student.academicYearId) yearIds.add(student.academicYearId);
    if (yearIds.size === 0) return result;

    const years = await manager.find(AcademicYear, {
      where: { id: In([...yearIds]) },
      withDeleted: true,
    });

    const classIds = new Set(feeEntities.map((f) => f.classId).filter(Boolean) as string[]);
    if (student.classId) classIds.add(student.classId);
    const structures = classIds.size
      ? await manager.find(FeeStructure, {
          where: {
            schoolId: student.schoolId,
            academicYearId: In([...yearIds]),
            classId: In([...classIds]),
          },
          relations: ['feeHead'],
        })
      : [];

    const discounts = await manager.find(StudentDiscount, {
      where: { studentId, isActive: true },
    });

    const feeIds = feeEntities.map((f) => f.id);
    const payments = feeIds.length
      ? await manager.find(Payment, {
          where: { studentFeeId: In(feeIds), status: PaymentStatus.COMPLETED },
        })
      : [];
    const paymentsByFee = new Map<string, Payment[]>();
    for (const p of payments) {
      const list = paymentsByFee.get(p.studentFeeId) ?? [];
      list.push(p);
      paymentsByFee.set(p.studentFeeId, list);
    }

    const openAdjustments = await manager.find(FeeAdjustment, {
      where: { studentId, status: FeeAdjustmentStatus.OPEN },
    });

    const headIds = new Set<string>();
    for (const f of feeEntities) for (const b of f.breakdown ?? []) headIds.add(b.feeHeadId);
    const heads = headIds.size
      ? await manager.find(FeeHead, { where: { id: In([...headIds]) }, withDeleted: true })
      : [];
    if (opts.headOverrides?.size) {
      for (const h of heads) Object.assign(h, opts.headOverrides.get(h.id) ?? {});
      for (const s of structures) {
        if (s.feeHead) Object.assign(s.feeHead, opts.headOverrides.get(s.feeHeadId) ?? {});
      }
    }
    const headApplicability = new Map(heads.map((h) => [h.id, h.applicableTo]));

    // Highest month already generated for the student's class this year.
    const latestGeneratedMonth = new Map<string, number>();
    if (student.academicYearId && student.classId) {
      const raw = await manager
        .createQueryBuilder(StudentFee, 'f')
        .select('MAX(f.month)', 'max')
        .where('f.school_id = :schoolId', { schoolId: student.schoolId })
        .andWhere('f.academic_year_id = :yearId', { yearId: student.academicYearId })
        .andWhere('f.class_id = :classId', { classId: student.classId })
        .andWhere('f.status != :cancelled', { cancelled: StudentFeeStatus.CANCELLED })
        .getRawOne<{ max: number | null }>();
      if (raw?.max) latestGeneratedMonth.set(student.academicYearId, Number(raw.max));
    }

    const plannerFees: PlannerFee[] = feeEntities.map((f) => ({
      id: f.id,
      academicYearId: f.academicYearId,
      month: f.month,
      classId: f.classId ?? null,
      sectionId: f.sectionId ?? null,
      status: f.status,
      baseAmount: f.baseAmount,
      discountAmount: f.discountAmount,
      payableAmount: f.payableAmount,
      paidAmount: f.paidAmount,
      breakdown: f.breakdown ?? [],
      voidSource: f.voidSource ?? null,
      deleted: !!f.deletedAt,
      payments: paymentsByFee.get(f.id) ?? [],
    }));

    const actions = planStudentReconcile({
      student: {
        id: student.id,
        schoolId: student.schoolId,
        classId: student.classId ?? null,
        sectionId: student.sectionId ?? null,
        academicYearId: student.academicYearId ?? null,
        isActive: student.status === StudentStatus.ACTIVE,
        admissionDate: student.admissionDate,
        studentType: student.studentType,
        studentTypeAcademicYearId: student.studentTypeAcademicYearId,
      },
      years,
      fees: plannerFees,
      structures,
      discounts,
      headApplicability,
      openAdjustments: openAdjustments.map((a) => ({
        id: a.id,
        studentFeeId: a.studentFeeId,
        kind: a.kind,
      })),
      latestGeneratedMonth,
      createMissing: opts.createMissing !== false,
    });

    const feeById = new Map(feeEntities.map((f) => [f.id, f]));
    const adjustmentById = new Map(openAdjustments.map((a) => [a.id, a]));
    let savepointSeq = 0;

    for (const action of actions) {
      switch (action.type) {
        case 'void': {
          const fee = feeById.get(action.feeId)!;
          fee.status = StudentFeeStatus.CANCELLED;
          fee.voidReason = action.reason;
          fee.voidSource = VOID_SOURCE_ADMISSION_DATE;
          fee.voidedAt = new Date();
          fee.voidedById = opts.actorId ?? null;
          await manager.save(fee);
          result.summary.voided++;
          break;
        }
        case 'reinstate': {
          const fee = feeById.get(action.feeId)!;
          fee.status = StudentFeeStatus.DUE;
          fee.voidReason = null;
          fee.voidSource = null;
          fee.voidedAt = null;
          fee.voidedById = null;
          fee.breakdown = action.breakdown;
          fee.baseAmount = action.baseAmount;
          fee.discountAmount = action.discountAmount;
          fee.payableAmount = action.payableAmount;
          await manager.save(fee);
          result.summary.reinstated++;
          break;
        }
        case 'rebuild': {
          const fee = feeById.get(action.feeId)!;
          fee.breakdown = action.breakdown;
          fee.baseAmount = action.baseAmount;
          fee.discountAmount = action.discountAmount;
          fee.payableAmount = action.payableAmount;
          await manager.save(fee);
          result.summary.rebuilt++;
          break;
        }
        case 'adjust_heads': {
          // Billed side only: paid amount, payments and receipts stay as they are.
          const fee = feeById.get(action.feeId)!;
          fee.breakdown = action.breakdown;
          fee.baseAmount = action.baseAmount;
          fee.discountAmount = action.discountAmount;
          fee.payableAmount = action.payableAmount;
          const paid = parseFloat(fee.paidAmount);
          const payable = parseFloat(action.payableAmount);
          fee.status =
            paid >= payable
              ? StudentFeeStatus.PAID
              : paid > 0
                ? StudentFeeStatus.PARTIAL
                : StudentFeeStatus.DUE;
          await manager.save(fee);
          result.summary.adjusted++;
          break;
        }
        case 'create': {
          // A concurrent generateFees may win the unique (student, year,
          // month) insert; recover without aborting the surrounding transaction.
          const savepoint = `fee_reconcile_${savepointSeq++}`;
          await manager.query(`SAVEPOINT ${savepoint}`);
          try {
            await manager.save(
              manager.create(StudentFee, {
                studentId: student.id,
                academicYearId: action.academicYearId,
                schoolId: student.schoolId,
                classId: action.classId,
                sectionId: action.sectionId ?? undefined,
                month: action.month,
                breakdown: action.breakdown,
                baseAmount: action.baseAmount,
                discountAmount: action.discountAmount,
                payableAmount: action.payableAmount,
                paidAmount: '0.00',
                status: StudentFeeStatus.DUE,
              }),
            );
            await manager.query(`RELEASE SAVEPOINT ${savepoint}`);
            result.summary.created++;
          } catch (error) {
            await manager.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            await manager.query(`RELEASE SAVEPOINT ${savepoint}`);
            const e = error as { code?: string; driverError?: { code?: string } };
            if ((e.driverError?.code ?? e.code) !== '23505') throw error;
          }
          break;
        }
        case 'flag': {
          await manager.save(
            manager.create(FeeAdjustment, {
              studentId: student.id,
              studentFeeId: action.feeId,
              schoolId: student.schoolId,
              academicYearId: action.academicYearId,
              month: action.month,
              kind: action.kind,
              amount: action.amount.toFixed(2),
              details: action.details,
              status: FeeAdjustmentStatus.OPEN,
            }),
          );
          result.summary.flagged++;
          break;
        }
        case 'dismiss_flag': {
          const adjustment = adjustmentById.get(action.adjustmentId)!;
          adjustment.status = FeeAdjustmentStatus.DISMISSED;
          adjustment.resolutionNote = action.note;
          adjustment.resolvedAt = new Date();
          await manager.save(adjustment);
          result.summary.dismissed++;
          break;
        }
      }
    }

    result.actions = actions;
    return result;
  }

  // ---------- Finance review of flagged money ----------

  async listAdjustments(query: ListFeeAdjustmentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const qb = this.dataSource
      .getRepository(FeeAdjustment)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.student', 'student')
      .leftJoinAndSelect('student.school', 'school')
      // PROPERTY names only: with skip/take TypeORM crashes on raw column
      // names in orderBy (same rule as the students list).
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query.schoolId) qb.andWhere('a.schoolId = :schoolId', { schoolId: query.schoolId });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.academicYearId) {
      qb.andWhere('a.academicYearId = :yearId', { yearId: query.academicYearId });
    }
    if (query.studentId) qb.andWhere('a.studentId = :studentId', { studentId: query.studentId });
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: a.student?.name ?? null,
        admissionNumber: a.student?.admissionNumber ?? null,
        schoolName: a.student?.school?.name ?? null,
        studentFeeId: a.studentFeeId,
        academicYearId: a.academicYearId,
        month: a.month,
        kind: a.kind,
        amount: parseFloat(a.amount),
        details: a.details,
        status: a.status,
        resolutionNote: a.resolutionNote,
        resolvedAt: a.resolvedAt,
        createdAt: a.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async resolveAdjustment(id: string, dto: ResolveFeeAdjustmentDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const adjustment = await manager.findOne(FeeAdjustment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adjustment) throw new NotFoundException('Adjustment not found');
      if (adjustment.status !== FeeAdjustmentStatus.OPEN) {
        throw new BadRequestException('Adjustment is already closed');
      }
      adjustment.status = dto.status;
      adjustment.resolutionNote = dto.note.trim();
      adjustment.resolvedById = userId;
      adjustment.resolvedAt = new Date();
      await manager.save(adjustment);
      return { id: adjustment.id, status: adjustment.status };
    });
  }
}
