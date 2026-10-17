import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  IsNull,
  DataSource,
  EntityManager,
} from 'typeorm';
import { StudentFee, StudentFeeStatus } from './entities/student-fee.entity';
import { likeContains } from '../common/utils/like-utils';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Receipt, ReceiptStatus } from './entities/receipt.entity';
import { Student, StudentStatus } from '../students/entities/student.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import { StudentDiscount } from '../fee-management/entities/student-discount.entity';
import { FeeHead } from '../fee-management/entities/fee-head.entity';
import {
  GenerateFeesDto,
  CollectPaymentDto,
  PaymentAllocationDto,
  ListPaymentsQueryDto,
} from './dto/fee-collection.dto';
import {
  toMoney,
  scheduleApplies,
  buildBreakdown,
  computeFeeTotals,
  breakdownEquals,
} from '../fee-management/fee-calculation';
import { computeHeadWisePaid } from './head-wise-paid';

@Injectable()
export class FeeCollectionService {
  private readonly logger = new Logger(FeeCollectionService.name);

  constructor(
    @InjectRepository(StudentFee)
    private readonly feesRepo: Repository<StudentFee>,
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Receipt)
    private readonly receiptsRepo: Repository<Receipt>,
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Fee generation (snapshot) ----------

  /**
   * Snapshots the monthly fee for every active student: standard fee
   * (school + academic year + class + month + fee head) minus applicable
   * student discounts. Idempotent — existing rows are never rewritten, so
   * later fee-structure changes cannot alter historical student fees.
   *
   * Fee schedule is enforced here: YEARLY heads are charged only in January,
   * HALF_YEARLY heads only in July — regardless of which months the operator
   * entered them in on the structure grid.
   */
  async generateFees(dto: GenerateFeesDto): Promise<{
    created: number;
    skipped: number;
    failed: { admissionNumber: string; reason: string }[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      const students = await manager.find(Student, {
        where: {
          schoolId: dto.schoolId,
          status: StudentStatus.ACTIVE,
          deletedAt: IsNull(),
          ...(dto.classId ? { classId: dto.classId } : {}),
        },
      });
      if (students.length === 0) return { created: 0, skipped: 0, failed: [] };

      const studentIds = students.map((s) => s.id);
      // Soft-deleted rows still occupy the (student, year, month) unique
      // index — counting them as existing prevents a unique violation if
      // the same month is ever regenerated.
      const existing = await manager.find(StudentFee, {
        where: {
          academicYearId: dto.academicYearId,
          month: dto.month,
          studentId: In(studentIds),
        },
        withDeleted: true,
      });
      const existingByStudent = new Map(existing.map((f) => [f.studentId, f]));

      const classIds = [...new Set(students.map((s) => s.classId).filter(Boolean))];
      const structures = classIds.length
        ? await manager.find(FeeStructure, {
            where: {
              schoolId: dto.schoolId,
              academicYearId: dto.academicYearId,
              classId: In(classIds),
              month: dto.month,
            },
            relations: ['feeHead'],
          })
        : [];
      const discounts = await manager.find(StudentDiscount, {
        where: { academicYearId: dto.academicYearId, studentId: In(studentIds), isActive: true },
      });

      let created = 0;
      let skipped = 0;
      const failed: { admissionNumber: string; reason: string }[] = [];

      for (const [index, student] of students.entries()) {
        if (existingByStudent.has(student.id)) {
          skipped++;
          continue;
        }
        const savepoint = `fee_generation_${index}`;
        let savepointCreated = false;
        // One bad student (e.g. a mis-keyed discount) must not abort the
        // whole batch — the failure is reported, the rest still generate.
        try {
          const rows = structures.filter(
            (f) => f.classId === student.classId && scheduleApplies(f, dto.month),
          );
          const breakdown = buildBreakdown(rows, discounts, student.id, dto.month);
          const { baseAmount, discountAmount, payableAmount } = computeFeeTotals(breakdown);
          if (payableAmount < 0) {
            throw new BadRequestException(
              `Discount exceeds fee for student ${student.admissionNumber}`,
            );
          }

          // A concurrent generation can win the unique student/year/month
          // insert after our existing-row check. Recover that row-level error
          // without leaving PostgreSQL's enclosing transaction aborted.
          await manager.query(`SAVEPOINT ${savepoint}`);
          savepointCreated = true;
          await manager.save(
            manager.create(StudentFee, {
              studentId: student.id,
              academicYearId: dto.academicYearId,
              schoolId: dto.schoolId,
              classId: student.classId,
              sectionId: student.sectionId,
              month: dto.month,
              breakdown,
              baseAmount: baseAmount.toFixed(2),
              discountAmount: discountAmount.toFixed(2),
              payableAmount: payableAmount.toFixed(2),
              paidAmount: '0.00',
              status: StudentFeeStatus.DUE,
            }),
          );
          await manager.query(`RELEASE SAVEPOINT ${savepoint}`);
          savepointCreated = false;
          created++;
        } catch (error) {
          if (savepointCreated) {
            await manager.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            await manager.query(`RELEASE SAVEPOINT ${savepoint}`);
          }
          const dbError = error as { code?: string; driverError?: { code?: string } };
          if ((dbError.driverError?.code ?? dbError.code) === '23505') {
            skipped++;
            continue;
          }
          // Only our own (HttpException) messages are client-safe; raw DB /
          // runtime errors would disclose table/column/constraint names.
          if (!(error instanceof HttpException)) {
            this.logger.error(
              `Fee generation failed for student ${student.id}: ${(error as Error)?.message ?? error}`,
            );
          }
          failed.push({
            admissionNumber: student.admissionNumber,
            reason: error instanceof HttpException ? error.message : 'Could not generate fee',
          });
        }
      }

      return { created, skipped, failed };
    });
  }

  /**
   * Recalculates unpaid fee snapshots (status DUE, nothing collected) for a
   * month against the CURRENT fee structure and discounts. Intentionally
   * overrides the snapshot-immutability of generated fees so a discount or
   * structure added after generation can be reconciled without touching
   * money already collected. Partial/paid/cancelled rows are never touched.
   */
  async recalculateFees(dto: GenerateFeesDto): Promise<{ updated: number; skipped: number }> {
    return this.dataSource.transaction((manager) =>
      this.recalculateMonthInManager(manager, dto),
    );
  }

  /** Same as recalculateFees, but joins the caller's transaction. */
  async recalculateFeesWith(
    manager: EntityManager,
    dto: GenerateFeesDto,
  ): Promise<{ updated: number; skipped: number }> {
    return this.recalculateMonthInManager(manager, dto);
  }

  /**
   * Recalculates one student's unpaid fee snapshots — every month of the
   * academic year (or of one specific year) — against the current fee
   * structure and discounts. Runs inside the discount create/update/remove
   * transaction so a discount added under the Student Discounts tab is
   * reflected in Monthly Collection immediately: generated snapshots are
   * otherwise never rewritten, because generateFees skips existing months.
   * Partial/paid/cancelled rows are never touched.
   */
  async recalculateStudentFees(
    studentId: string,
    academicYearId?: string,
    manager?: EntityManager,
  ): Promise<{ updated: number; skipped: number }> {
    const run = (m: EntityManager) =>
      this.recalculateStudentInManager(m, studentId, academicYearId);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private async recalculateMonthInManager(
    manager: EntityManager,
    dto: GenerateFeesDto,
  ): Promise<{ updated: number; skipped: number }> {
    const fees = await manager.find(StudentFee, {
      where: {
        schoolId: dto.schoolId,
        academicYearId: dto.academicYearId,
        month: dto.month,
        paidAmount: '0.00',
        status: StudentFeeStatus.DUE,
        ...(dto.classId ? { classId: dto.classId } : {}),
      },
    });
    if (fees.length === 0) return { updated: 0, skipped: 0 };

    const discounts = await manager.find(StudentDiscount, {
      where: {
        academicYearId: dto.academicYearId,
        studentId: In(fees.map((f) => f.studentId)),
        isActive: true,
      },
    });
    const structures = await this.loadStructures(manager, fees);
    return this.recalculateRows(manager, fees, structures, discounts);
  }

  private async recalculateStudentInManager(
    manager: EntityManager,
    studentId: string,
    academicYearId?: string,
  ): Promise<{ updated: number; skipped: number }> {
    // Scope recalculation to the student's current school so a discount added
    // after a cross-school transfer never rewrites unpaid snapshots belonging
    // to the student's previous school.
    const student = await manager.findOne(Student, {
      where: { id: studentId },
      select: ['id', 'schoolId'],
    });
    const fees = await manager.find(StudentFee, {
      where: {
        studentId,
        ...(student?.schoolId ? { schoolId: student.schoolId } : {}),
        paidAmount: '0.00',
        status: StudentFeeStatus.DUE,
        ...(academicYearId ? { academicYearId } : {}),
      },
    });
    if (fees.length === 0) return { updated: 0, skipped: 0 };

    // A student can carry fee rows across academic years (e.g. after a
    // promotion) while discounts are year-scoped — filter per row below.
    const discounts = await manager.find(StudentDiscount, {
      where: { studentId, isActive: true },
    });
    const structures = await this.loadStructures(manager, fees);
    return this.recalculateRows(manager, fees, structures, discounts);
  }

  private async loadStructures(
    manager: EntityManager,
    fees: StudentFee[],
  ): Promise<FeeStructure[]> {
    const schoolIds = [...new Set(fees.map((f) => f.schoolId))];
    const yearIds = [...new Set(fees.map((f) => f.academicYearId))];
    const months = [...new Set(fees.map((f) => f.month))];
    const classIds = [...new Set(fees.map((f) => f.classId).filter(Boolean))] as string[];
    if (!schoolIds.length || !yearIds.length || !months.length) return [];
    return manager.find(FeeStructure, {
      where: {
        schoolId: In(schoolIds),
        academicYearId: In(yearIds),
        month: In(months),
        ...(classIds.length ? { classId: In(classIds) } : {}),
      },
      relations: ['feeHead'],
    });
  }

  private async recalculateRows(
    manager: EntityManager,
    fees: StudentFee[],
    structures: FeeStructure[],
    discounts: StudentDiscount[],
  ): Promise<{ updated: number; skipped: number }> {
    let updated = 0;
    let skipped = 0;
    for (const fee of fees) {
      // classId/year/month come from the fee row itself — the snapshot
      // belongs to the class at generation time, not the student's current one.
      const rows = structures.filter(
        (s) =>
          s.schoolId === fee.schoolId &&
          s.classId === fee.classId &&
          s.academicYearId === fee.academicYearId &&
          s.month === fee.month &&
          scheduleApplies(s, fee.month),
      );
      const applicableDiscounts = discounts.filter(
        (d) => d.academicYearId === fee.academicYearId,
      );

      // No (schedule-applicable) structure row left for this month means the
      // current structure no longer charges anything — clear the unpaid row.
      const breakdown = rows.length
        ? buildBreakdown(rows, applicableDiscounts, fee.studentId, fee.month)
        : [];
      const totals = computeFeeTotals(breakdown);

      const unchanged =
        breakdownEquals(breakdown, fee.breakdown ?? []) &&
        totals.baseAmount === toMoney(parseFloat(fee.baseAmount)) &&
        totals.discountAmount === toMoney(parseFloat(fee.discountAmount)) &&
        totals.payableAmount === toMoney(parseFloat(fee.payableAmount));
      if (unchanged) {
        skipped++;
        continue;
      }
      fee.breakdown = breakdown;
      fee.baseAmount = totals.baseAmount.toFixed(2);
      fee.discountAmount = totals.discountAmount.toFixed(2);
      fee.payableAmount = totals.payableAmount.toFixed(2);
      await manager.save(fee);
      updated++;
    }
    return { updated, skipped };
  }

  // ---------- Monthly collection ----------

  /**
   * The main collection view: lists students of a class/section with their
   * fee snapshot for the month, their previous arrear and payment status.
   *
   * Snapshots are generated once and never rewritten, so rows created before
   * a structure grid was saved or edited (Nursery students whose month-1 fees
   * were generated before their structure existed showed no heads at all)
   * would render stale head lists and amounts forever. Reconcile the unpaid
   * rows of exactly this view's scope (school + year + month + class) before
   * reading: DUE rows are rebuilt from the current structure/discounts;
   * partial/paid rows are never touched. Best-effort — a sync failure must
   * never blank the collection grid.
   */
  async monthlyCollection(
    schoolId: string,
    academicYearId: string,
    month: number,
    classId?: string,
    sectionId?: string,
  ) {
    try {
      await this.recalculateFees({
        schoolId,
        academicYearId,
        month,
        ...(classId ? { classId } : {}),
      });
    } catch (error) {
      // sync is best-effort — the read below still returns the stored rows,
      // but a failure must leave a trace (OWASP A09).
      this.logger.warn(`Fee recalculation (monthly view) failed: ${(error as Error)?.message ?? error}`);
    }
    const students = await this.studentsRepo.find({
      where: {
        schoolId,
        status: StudentStatus.ACTIVE,
        deletedAt: IsNull(),
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      relations: ['schoolClass', 'section'],
      order: { rollNumber: 'ASC', name: 'ASC' },
    });
    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const fees = await this.feesRepo.find({
      where: { academicYearId, studentId: In(studentIds) },
    });

    const feeByStudentMonth = new Map<string, StudentFee>();
    for (const fee of fees) {
      if (fee.month === month) feeByStudentMonth.set(fee.studentId, fee);
    }

    // previous arrear: total due from all months before the selected month
    const previousDueByStudent = new Map<string, number>();
    for (const fee of fees) {
      if (fee.month >= month || fee.status === StudentFeeStatus.CANCELLED) continue;
      const due = parseFloat(fee.payableAmount) - parseFloat(fee.paidAmount);
      if (due > 0) {
        previousDueByStudent.set(
          fee.studentId,
          toMoney((previousDueByStudent.get(fee.studentId) ?? 0) + due),
        );
      }
    }

    return students.map((student) => {
      const fee = feeByStudentMonth.get(student.id) ?? null;
      const currentFee = fee
        ? {
            id: fee.id,
            baseAmount: parseFloat(fee.baseAmount),
            discountAmount: parseFloat(fee.discountAmount),
            payableAmount: parseFloat(fee.payableAmount),
            paidAmount: parseFloat(fee.paidAmount),
            dueAmount: toMoney(parseFloat(fee.payableAmount) - parseFloat(fee.paidAmount)),
            status: fee.status,
            breakdown: fee.breakdown,
          }
        : null;
      return {
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: student.name,
          rollNumber: student.rollNumber,
          className: student.schoolClass?.name ?? null,
          sectionName: student.section?.name ?? null,
        },
        currentFee,
        previousDue: toMoney(previousDueByStudent.get(student.id) ?? 0),
        totalDue: fee
          ? toMoney(
              (previousDueByStudent.get(student.id) ?? 0) +
                (parseFloat(fee.payableAmount) - parseFloat(fee.paidAmount)),
            )
          : toMoney(previousDueByStudent.get(student.id) ?? 0),
      };
    });
  }

  // ---------- Payments ----------

  private async nextReceiptNumber(
    manager: EntityManager,
  ): Promise<string> {
    // Business year in Bangladesh time (payments are dated in Asia/Dhaka); the
    // server's UTC year mislabelled receipts issued 00:00–05:59 on 1 January.
    const year = Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric' }).format(new Date()),
    );
    // Serialize concurrent numbering — two simultaneous payments for different
    // students must never compute the same receipt number.
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('edu_receipts_${year}'))`);
    const prefix = `RCPT-${year}-`;
    const rows = await manager
      .createQueryBuilder(Receipt, 'r')
      .select('r.receipt_number', 'rn')
      .where('r.receipt_number LIKE :prefix', { prefix: `${prefix}%` })
      .withDeleted()
      .getRawMany();
    let max = 0;
    for (const row of rows) {
      const seq = parseInt(row.rn.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
    return `${prefix}${String(max + 1).padStart(6, '0')}`;
  }

  /**
   * Posts a payment against a specific month's student fee, generates the
   * unique receipt and updates the fee's paid/due state — all in one
   * transaction.
   *
   * The payment is allocated per fee head:
   *  - explicit `allocations` pay selected heads only (sum must equal amount);
   *  - heads with `installmentAllowed` accept partial amounts, other heads
   *    must be paid in full;
   *  - with no `allocations` the amount is applied head-by-head (full heads
   *    first, installment heads absorb the remainder).
   */
  async collectPayment(dto: CollectPaymentDto, userId: string) {
    const amount = toMoney(dto.amount);

    // Payments must land on the BD calendar day they are recorded at the
    // latest — future-dating distorts every date-bucketed report.
    if (dto.paymentDate) {
      const bdToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
        new Date(),
      );
      if (dto.paymentDate.slice(0, 10) > bdToday) {
        throw new BadRequestException('Payment date cannot be in the future');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const fee = await manager
        .createQueryBuilder(StudentFee, 'f')
        .setLock('pessimistic_write')
        .where('f.id = :id', { id: dto.studentFeeId })
        .getOne();
      if (!fee) throw new NotFoundException('Student fee record not found');

      // Idempotent replay (double click / retried request): checked under the
      // fee row lock, so a concurrent duplicate waits for the first insert and
      // then finds it here instead of posting a second payment + receipt.
      if (dto.idempotencyKey) {
        const previous = await manager.findOne(Payment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (previous) {
          if (
            previous.studentFeeId !== fee.id ||
            previous.collectedById !== userId ||
            toMoney(parseFloat(previous.amount)) !== amount
          ) {
            throw new BadRequestException('Idempotency key was already used for a different payment');
          }
          const previousReceipt = await manager.findOne(Receipt, {
            where: { paymentId: previous.id },
            relations: ['student', 'student.school', 'student.schoolClass', 'student.section'],
          });
          return { payment: previous, receipt: previousReceipt, fee };
        }
      }

      if (fee.status === StudentFeeStatus.CANCELLED) {
        throw new BadRequestException('This fee record is cancelled');
      }

      const payable = parseFloat(fee.payableAmount);
      const alreadyPaid = parseFloat(fee.paidAmount);
      const remaining = toMoney(payable - alreadyPaid);
      if (remaining <= 0) {
        throw new BadRequestException('This month is already fully paid');
      }
      if (amount > remaining) {
        throw new BadRequestException(
          `Amount exceeds remaining due of ${remaining.toFixed(2)}`,
        );
      }

      // head-wise payment state: what each head has already received
      const breakdown = fee.breakdown ?? [];
      const completedPayments = await manager.find(Payment, {
        where: { studentFeeId: fee.id, status: PaymentStatus.COMPLETED },
      });
      const headPaid = computeHeadWisePaid(breakdown, completedPayments);

      const heads = breakdown.length
        ? await manager.find(FeeHead, { where: { id: In(breakdown.map((b) => b.feeHeadId)) } })
        : [];
      const installmentByHead = new Map(heads.map((h) => [h.id, h.installmentAllowed]));

      const allocations = dto.allocations?.length
        ? this.validateAllocations(dto.allocations, breakdown, headPaid, installmentByHead, amount)
        : this.autoAllocate(amount, breakdown, headPaid, installmentByHead);

      const student = await manager.findOne(Student, {
        where: { id: fee.studentId },
      });
      if (!student) throw new NotFoundException('Student not found');
      if (student.status !== StudentStatus.ACTIVE) {
        throw new BadRequestException('Payments can only be collected for active students');
      }

      const payment = await manager.save(
        manager.create(Payment, {
          studentId: fee.studentId,
          studentFeeId: fee.id,
          schoolId: fee.schoolId,
          amount: amount.toFixed(2),
          allocations,
          paymentMethod: dto.paymentMethod,
          transactionRef: dto.transactionRef,
          bankName: dto.bankName,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          collectedById: userId,
          status: PaymentStatus.COMPLETED,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );

      const receiptNumber = await this.nextReceiptNumber(manager);
      const receipt = await manager.save(
        manager.create(Receipt, {
          receiptNumber,
          paymentId: payment.id,
          studentId: fee.studentId,
          amount: amount.toFixed(2),
          issuedById: userId,
          status: ReceiptStatus.ACTIVE,
        }),
      );

      const newPaid = toMoney(alreadyPaid + amount);
      fee.paidAmount = newPaid.toFixed(2);
      fee.status = this.deriveStatus(payable, newPaid);
      await manager.save(fee);

      // The freshly saved receipt has no relations loaded — the client renders
      // receipt.student.{name,admissionNumber,school,schoolClass,section} in
      // the receipt modal immediately after this call, and a bare entity
      // crashed it with a TypeError after every successful collection. Reload
      // it with the same shape GET /payments/:id/receipt returns.
      const issuedReceipt = await manager.findOne(Receipt, {
        where: { id: receipt.id },
        relations: ['student', 'student.school', 'student.schoolClass', 'student.section'],
      });

      return { payment, receipt: issuedReceipt ?? receipt, fee };
    });
  }

  private validateAllocations(
    allocations: PaymentAllocationDto[],
    breakdown: StudentFee['breakdown'],
    headPaid: Map<string, number>,
    installmentByHead: Map<string, boolean>,
    amount: number,
  ): Array<{ feeHeadId: string; feeHeadName: string; amount: number }> {
    const byId = new Map(breakdown.map((b) => [b.feeHeadId, b]));
    const seen = new Set<string>();
    const result: Array<{ feeHeadId: string; feeHeadName: string; amount: number }> = [];
    let total = 0;

    for (const alloc of allocations) {
      const head = byId.get(alloc.feeHeadId);
      if (!head) {
        throw new BadRequestException('Allocation references a fee head that is not part of this month fee');
      }
      if (seen.has(alloc.feeHeadId)) {
        throw new BadRequestException(`Fee head "${head.feeHeadName}" is allocated more than once`);
      }
      seen.add(alloc.feeHeadId);

      const line = toMoney(alloc.amount);
      const headRemaining = toMoney(head.payable - (headPaid.get(alloc.feeHeadId) ?? 0));
      if (line > headRemaining + 0.009) {
        throw new BadRequestException(
          `Allocated ${line.toFixed(2)} for "${head.feeHeadName}" exceeds its remaining due of ${headRemaining.toFixed(2)}`,
        );
      }
      if (!installmentByHead.get(alloc.feeHeadId) && headRemaining - line > 0.009) {
        throw new BadRequestException(
          `"${head.feeHeadName}" does not accept installments — it must be paid in full (${headRemaining.toFixed(2)})`,
        );
      }

      total = toMoney(total + line);
      result.push({ feeHeadId: head.feeHeadId, feeHeadName: head.feeHeadName, amount: line });
    }

    if (toMoney(total) !== toMoney(amount)) {
      throw new BadRequestException(
        `Allocated total (${total.toFixed(2)}) does not match the payment amount (${amount.toFixed(2)})`,
      );
    }
    return result;
  }

  private autoAllocate(
    amount: number,
    breakdown: StudentFee['breakdown'],
    headPaid: Map<string, number>,
    installmentByHead: Map<string, boolean>,
  ): Array<{ feeHeadId: string; feeHeadName: string; amount: number }> {
    let left = amount;
    const result: Array<{ feeHeadId: string; feeHeadName: string; amount: number }> = [];

    for (const head of breakdown) {
      if (left <= 0.009) break;
      const headRemaining = toMoney(head.payable - (headPaid.get(head.feeHeadId) ?? 0));
      if (headRemaining <= 0) continue;
      const installment = installmentByHead.get(head.feeHeadId) ?? false;
      const pay = installment
        ? Math.min(headRemaining, left)
        : left + 0.009 >= headRemaining
          ? headRemaining
          : 0;
      if (pay <= 0) continue;
      result.push({ feeHeadId: head.feeHeadId, feeHeadName: head.feeHeadName, amount: toMoney(pay) });
      left = toMoney(left - pay);
    }

    if (left > 0.009) {
      throw new BadRequestException(
        'The amount cannot cover the remaining fee heads in full. Heads that do not accept installments must be paid in full — select heads and amounts explicitly.',
      );
    }
    return result;
  }

  private deriveStatus(payable: number, paid: number): StudentFeeStatus {
    if (paid >= payable) return StudentFeeStatus.PAID;
    if (paid > 0) return StudentFeeStatus.PARTIAL;
    return StudentFeeStatus.DUE;
  }

  /**
   * Cancels a payment (e.g. wrong entry): the payment and its receipt are
   * voided, never deleted, and the fee's paid amount is rolled back.
   */
  async cancelPayment(paymentId: string, reason: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :paymentId', { paymentId })
        .getOne();
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment is already cancelled/refunded');
      }

      const fee = await manager.createQueryBuilder(StudentFee, 'f')
        .setLock('pessimistic_write')
        .where('f.id = :feeId', { feeId: payment.studentFeeId })
        .getOne();
      if (!fee) throw new NotFoundException('Student fee record not found');

      payment.status = PaymentStatus.CANCELLED;
      payment.cancelReason = reason;
      payment.cancelledById = userId;
      payment.cancelledAt = new Date();
      await manager.save(payment);

      await manager
        .createQueryBuilder()
        .update(Receipt)
        .set({ status: ReceiptStatus.CANCELLED, cancelledAt: new Date() })
        .where('payment_id = :paymentId', { paymentId })
        .execute();

      const paidFromActive = await manager
        .createQueryBuilder(Payment, 'p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.student_fee_id = :feeId', { feeId: fee.id })
        .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED })
        .getRawOne();

      const newPaid = toMoney(parseFloat(paidFromActive.total));
      fee.paidAmount = newPaid.toFixed(2);
      fee.status = this.deriveStatus(parseFloat(fee.payableAmount), newPaid);
      await manager.save(fee);

      return { payment, fee };
    });
  }

  async listPayments(query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const qb = this.paymentsRepo
      .createQueryBuilder('p')
      .leftJoin('p.student', 'student')
      .addSelect(['student.id', 'student.name', 'student.admissionNumber', 'student.schoolId'])
      .leftJoinAndSelect('p.studentFee', 'fee')
      .leftJoin('p.collectedBy', 'collectedBy')
      .addSelect(['collectedBy.id', 'collectedBy.firstName', 'collectedBy.lastName'])
      .orderBy('p.paymentDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.schoolId) qb.andWhere('p.school_id = :schoolId', { schoolId: query.schoolId });
    if (query.studentId) qb.andWhere('p.student_id = :studentId', { studentId: query.studentId });
    if (query.month) qb.andWhere('fee.month = :month', { month: query.month });
    if (query.paymentMethod) qb.andWhere('p.payment_method = :method', { method: query.paymentMethod });
    // Date filters compare on the BD calendar day (payment_date is timestamptz;
    // forcing UTC day boundaries mis-bucketed early-morning local payments).
    if (query.dateFrom)
      qb.andWhere(`(p.payment_date AT TIME ZONE 'Asia/Dhaka')::date >= :dateFrom`, { dateFrom: query.dateFrom });
    if (query.dateTo)
      qb.andWhere(`(p.payment_date AT TIME ZONE 'Asia/Dhaka')::date <= :dateTo`, { dateTo: query.dateTo });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findReceipt(paymentId: string) {
    const receipt = await this.receiptsRepo.findOne({
      where: { paymentId },
      relations: [
        'payment',
        'payment.studentFee',
        'student',
        'student.school',
        'student.schoolClass',
        'student.section',
        'student.academicYear',
      ],
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    const { student, ...details } = receipt;
    return {
      ...details,
      student: {
        id: student.id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        school: student.school && { id: student.school.id, name: student.school.name },
        schoolClass: student.schoolClass && { id: student.schoolClass.id, name: student.schoolClass.name },
        section: student.section && { id: student.section.id, name: student.section.name },
        academicYear: student.academicYear && { id: student.academicYear.id, name: student.academicYear.name },
      },
    };
  }

  async findReceipts(schoolId: string, search?: string) {
    if (search && search.length > 150) throw new BadRequestException('Search is too long');
    const qb = this.receiptsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.payment', 'payment')
      .leftJoinAndSelect('payment.studentFee', 'fee')
      .leftJoin('r.student', 'student')
      .addSelect(['student.id', 'student.name', 'student.admissionNumber'])
      .where('payment.school_id = :schoolId', { schoolId })
      .orderBy('r.createdAt', 'DESC')
      .take(100);

    if (search) {
      qb.andWhere('(r.receipt_number ILIKE :search OR student.name ILIKE :search OR student.admission_number ILIKE :search)', {
        search: likeContains(search),
      });
    }
    return qb.getMany();
  }

  // ---------- Student dues ----------

  /**
   * Reconciles a student's unpaid snapshots for every academic year present
   * in their fee rows. Year-scoped so rows of one year are never recomputed
   * against another year's structure. Best-effort — callers render the stored
   * rows if the sync fails.
   */
  private async syncStudentFeeSnapshots(studentId: string): Promise<void> {
    try {
      const rows = await this.feesRepo.find({
        where: { studentId },
        select: ['academicYearId'],
      });
      for (const yearId of [...new Set(rows.map((r) => r.academicYearId))]) {
        await this.recalculateStudentFees(studentId, yearId);
      }
    } catch (error) {
      // sync is best-effort — the reads below still return the stored rows,
      // but a failure must leave a trace (OWASP A09).
      this.logger.warn(`Fee recalculation for student ${studentId} failed: ${(error as Error)?.message ?? error}`);
    }
  }

  /** All month rows for a student (paid and unpaid) — preserves the origin month of each due. */
  async studentDues(studentId: string) {
    await this.syncStudentFeeSnapshots(studentId);
    const fees = await this.feesRepo.find({
      where: { studentId },
      order: { month: 'ASC' },
    });
    return fees
      .filter((f) => f.status !== StudentFeeStatus.CANCELLED)
      .map((f) => ({
        id: f.id,
        month: f.month,
        baseAmount: parseFloat(f.baseAmount),
        discountAmount: parseFloat(f.discountAmount),
        payableAmount: parseFloat(f.payableAmount),
        paidAmount: parseFloat(f.paidAmount),
        dueAmount: toMoney(parseFloat(f.payableAmount) - parseFloat(f.paidAmount)),
        status: f.status,
        breakdown: f.breakdown,
      }));
  }

  async studentFeeSummary(studentId: string) {
    await this.syncStudentFeeSnapshots(studentId);
    const fees = await this.feesRepo.find({
      where: { studentId, deletedAt: IsNull() },
    });
    const active = fees.filter((f) => f.status !== StudentFeeStatus.CANCELLED);
    const baseAmount = toMoney(active.reduce((s, f) => s + parseFloat(f.baseAmount), 0));
    const discountAmount = toMoney(active.reduce((s, f) => s + parseFloat(f.discountAmount), 0));
    const payableAmount = toMoney(active.reduce((s, f) => s + parseFloat(f.payableAmount), 0));
    const paidAmount = toMoney(active.reduce((s, f) => s + parseFloat(f.paidAmount), 0));
    return {
      baseAmount,
      discountAmount,
      payableAmount,
      paidAmount,
      dueAmount: toMoney(payableAmount - paidAmount),
      months: fees
        .sort((a, b) => a.month - b.month)
        .map((f) => ({
          id: f.id,
          month: f.month,
          baseAmount: parseFloat(f.baseAmount),
          discountAmount: parseFloat(f.discountAmount),
          payableAmount: parseFloat(f.payableAmount),
          paidAmount: parseFloat(f.paidAmount),
          dueAmount: toMoney(parseFloat(f.payableAmount) - parseFloat(f.paidAmount)),
          status: f.status,
        })),
    };
  }

  /**
   * Head-wise dues of a student, month by month — powers the dues detail
   * modal. Each due month lists every fee head with its payable, paid and
   * due amount (installment-friendly partial payments included).
   */
  async studentDuesByHead(studentId: string, academicYearId?: string) {
    await this.syncStudentFeeSnapshots(studentId);
    const fees = await this.feesRepo.find({
      where: {
        studentId,
        deletedAt: IsNull(),
        ...(academicYearId ? { academicYearId } : {}),
      },
      order: { month: 'ASC' },
    });

    const active = fees.filter((f) => {
      if (f.status === StudentFeeStatus.CANCELLED) return false;
      return toMoney(parseFloat(f.payableAmount) - parseFloat(f.paidAmount)) > 0;
    });

    if (active.length === 0) {
      return {
        months: [],
        totals: { payable: 0, paid: 0, due: 0 },
      };
    }

    const payments = await this.paymentsRepo.find({
      where: { studentId, status: PaymentStatus.COMPLETED },
    });
    const paymentsByFee = new Map<string, Payment[]>();
    for (const p of payments) {
      const list = paymentsByFee.get(p.studentFeeId) ?? [];
      list.push(p);
      paymentsByFee.set(p.studentFeeId, list);
    }

    let totals = { payable: 0, paid: 0, due: 0 };
    const months = active.map((f) => {
      const breakdown = f.breakdown ?? [];
      const headPaid = computeHeadWisePaid(breakdown, paymentsByFee.get(f.id) ?? []);

      const heads = breakdown
        .map((b) => {
          const paid = toMoney(headPaid.get(b.feeHeadId) ?? 0);
          const due = toMoney(b.payable - paid);
          return {
            feeHeadId: b.feeHeadId,
            feeHeadName: b.feeHeadName,
            payable: toMoney(b.payable),
            paid,
            due,
          };
        })
        // Fully-paid heads stay visible in a partially-due month so the
        // month totals reconcile with the fee's stored paidAmount (dropping
        // them would make collected money vanish from the sums).
        .filter((h) => h.due > 0.009 || h.paid > 0.009);

      const payable = toMoney(heads.reduce((s, h) => s + h.payable, 0));
      const paid = toMoney(heads.reduce((s, h) => s + h.paid, 0));
      const due = toMoney(heads.reduce((s, h) => s + h.due, 0));
      totals = {
        payable: toMoney(totals.payable + payable),
        paid: toMoney(totals.paid + paid),
        due: toMoney(totals.due + due),
      };

      return {
        id: f.id,
        academicYearId: f.academicYearId,
        month: f.month,
        heads,
        payable,
        paid,
        due,
        status: f.status,
      };
    });

    return { months, totals };
  }

  async findFeeById(id: string): Promise<StudentFee> {
    const fee = await this.feesRepo.findOne({ where: { id } });
    if (!fee) throw new NotFoundException('Student fee record not found');
    return fee;
  }
}
