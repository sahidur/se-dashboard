import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Receipt, ReceiptStatus } from './entities/receipt.entity';
import { Student, StudentStatus } from '../students/entities/student.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import {
  StudentDiscount,
  DiscountType,
} from '../fee-management/entities/student-discount.entity';
import { FeeHead, FeeSchedule } from '../fee-management/entities/fee-head.entity';
import {
  GenerateFeesDto,
  CollectPaymentDto,
  PaymentAllocationDto,
  ListPaymentsQueryDto,
} from './dto/fee-collection.dto';
import { toMoney } from '../fee-management/fee-management.service';

const MONTHS_IN_YEAR = 12;

@Injectable()
export class FeeCollectionService {
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
  async generateFees(dto: GenerateFeesDto): Promise<{ created: number; skipped: number }> {
    return this.dataSource.transaction(async (manager) => {
      const students = await manager.find(Student, {
        where: {
          schoolId: dto.schoolId,
          status: StudentStatus.ACTIVE,
          deletedAt: IsNull(),
          ...(dto.classId ? { classId: dto.classId } : {}),
        },
      });
      if (students.length === 0) return { created: 0, skipped: 0 };

      const studentIds = students.map((s) => s.id);
      const existing = await manager.find(StudentFee, {
        where: {
          academicYearId: dto.academicYearId,
          month: dto.month,
          studentId: In(studentIds),
        },
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

      for (const student of students) {
        if (existingByStudent.has(student.id)) {
          skipped++;
          continue;
        }
        const rows = structures.filter((f) => {
          if (f.classId !== student.classId) return false;
          if (f.feeHead?.feeSchedule === FeeSchedule.YEARLY) return dto.month === 1;
          if (f.feeHead?.feeSchedule === FeeSchedule.HALF_YEARLY) return dto.month === 7;
          return true;
        });
        const breakdown = rows.map((row) => {
          const base = parseFloat(row.amount);
          const discount = this.computeDiscount(
            discounts,
            student.id,
            row.feeHeadId,
            base,
            dto.month,
            rows.map((r) => parseFloat(r.amount)),
          );
          return {
            feeHeadId: row.feeHeadId,
            feeHeadName: row.feeHead.name,
            base: toMoney(base),
            discount: toMoney(discount),
            payable: toMoney(base - discount),
          };
        });

        const baseAmount = toMoney(breakdown.reduce((sum, b) => sum + b.base, 0));
        const discountAmount = toMoney(breakdown.reduce((sum, b) => sum + b.discount, 0));
        const payableAmount = toMoney(baseAmount - discountAmount);
        if (payableAmount < 0) {
          throw new BadRequestException(
            `Discount exceeds fee for student ${student.admissionNumber}`,
          );
        }

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
        created++;
      }

      return { created, skipped };
    });
  }

  /**
   * Applies the student's active discounts for the given month to one fee
   * head's base amount. Head-level discounts apply to that head only;
   * total-level discounts distribute proportionally over the head amounts.
   */
  private computeDiscount(
    discounts: StudentDiscount[],
    studentId: string,
    feeHeadId: string,
    headBase: number,
    month: number,
    allHeadBases: number[],
  ): number {
    let discount = 0;
    let totalDiscount = 0;

    const totalBase = allHeadBases.reduce((s, v) => s + v, 0);
    if (totalBase <= 0) return 0;

    for (const d of discounts) {
      if (d.studentId !== studentId) continue;
      const applicable = d.isRecurring
        ? true
        : month >= (d.effectiveFromMonth ?? 1) && month <= (d.effectiveToMonth ?? MONTHS_IN_YEAR);
      if (!applicable) continue;

      const value = parseFloat(d.value);
      if (d.feeHeadId === feeHeadId) {
        discount += d.type === DiscountType.PERCENTAGE ? (headBase * value) / 100 : value;
      } else if (d.feeHeadId === null) {
        // share of the total-fee discount proportional to this head's base
        const share = totalBase > 0 ? headBase / totalBase : 0;
        const amount =
          d.type === DiscountType.PERCENTAGE ? (totalBase * value) / 100 : value;
        totalDiscount += amount * share;
      }
    }

    return toMoney(discount + totalDiscount);
  }

  // ---------- Monthly collection ----------

  /**
   * The main collection view: lists students of a class/section with their
   * fee snapshot for the month, their previous arrear and payment status.
   */
  async monthlyCollection(
    schoolId: string,
    academicYearId: string,
    month: number,
    classId?: string,
    sectionId?: string,
  ) {
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
    const year = new Date().getFullYear();
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

    return this.dataSource.transaction(async (manager) => {
      const fee = await manager
        .createQueryBuilder(StudentFee, 'f')
        .setLock('pessimistic_write')
        .where('f.id = :id', { id: dto.studentFeeId })
        .getOne();
      if (!fee) throw new NotFoundException('Student fee record not found');
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
      const headPaid = this.computeHeadPaid(breakdown, completedPayments);

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

      return { payment, receipt, fee };
    });
  }

  /**
   * Paid amount per fee head for one month. Payments that carry explicit
   * head allocations are summed per head; legacy month-level payments
   * (no allocations) are distributed proportionally by head payable share.
   * The two kinds can coexist on one fee (old data + new allocations) —
   * each payment is attributed independently so no collected money is lost.
   */
  private computeHeadPaid(
    breakdown: StudentFee['breakdown'],
    completedPayments: Payment[],
  ): Map<string, number> {
    const paid = new Map<string, number>();
    const payableTotal = breakdown.reduce((s, b) => s + b.payable, 0);
    let legacyTotal = 0;

    for (const p of completedPayments) {
      if ((p.allocations ?? []).length > 0) {
        for (const a of p.allocations ?? []) {
          paid.set(a.feeHeadId, toMoney((paid.get(a.feeHeadId) ?? 0) + (a.amount ?? 0)));
        }
      } else {
        legacyTotal = toMoney(legacyTotal + parseFloat(p.amount));
      }
    }

    if (legacyTotal > 0) {
      for (const b of breakdown) {
        const share = payableTotal > 0 ? b.payable / payableTotal : 0;
        paid.set(b.feeHeadId, toMoney((paid.get(b.feeHeadId) ?? 0) + legacyTotal * share));
      }
    }
    return paid;
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
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment is already cancelled/refunded');
      }

      const fee = await manager.findOne(StudentFee, {
        where: { id: payment.studentFeeId },
      });
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
      .leftJoinAndSelect('p.student', 'student')
      .leftJoinAndSelect('p.studentFee', 'fee')
      .leftJoinAndSelect('p.collectedBy', 'collectedBy')
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
        'payment.collectedBy',
        'student',
        'student.school',
        'student.schoolClass',
        'student.section',
        'student.academicYear',
      ],
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  async findReceipts(schoolId: string, search?: string) {
    const qb = this.receiptsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.payment', 'payment')
      .leftJoinAndSelect('payment.studentFee', 'fee')
      .leftJoinAndSelect('r.student', 'student')
      .where('student.school_id = :schoolId', { schoolId })
      .orderBy('r.createdAt', 'DESC')
      .take(100);

    if (search) {
      qb.andWhere('(r.receipt_number ILIKE :search OR student.name ILIKE :search OR student.admission_number ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    return qb.getMany();
  }

  // ---------- Student dues ----------

  /** All month rows for a student (paid and unpaid) — preserves the origin month of each due. */
  async studentDues(studentId: string) {
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
      const headPaid = this.computeHeadPaid(
        breakdown,
        paymentsByFee.get(f.id) ?? [],
      );

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
        .filter((h) => h.due > 0.009);

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
