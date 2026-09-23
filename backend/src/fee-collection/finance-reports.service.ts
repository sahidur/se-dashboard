import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { StudentFee, StudentFeeStatus } from './entities/student-fee.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Student, StudentStatus } from '../students/entities/student.entity';
import { SchoolClass } from '../students/entities/school-class.entity';
import { SchoolSection } from '../students/entities/section.entity';
import { toMoney } from '../fee-management/fee-management.service';
import { AopTarget } from '../fee-management/entities/aop-target.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import { FeeHead, FeeSchedule } from '../fee-management/entities/fee-head.entity';
import { AcademicYear } from '../fee-management/entities/academic-year.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { SaveAopTargetsDto } from './dto/aop-target.dto';

export interface RevenueHeadCell {
  planned: number;
  collected: number;
  due: number;
}

export interface AopClassFee {
  feeHeadId: string;
  feeHeadName: string;
  feeSchedule: string;
  /** Year-effective per-student amount (schedule-aware) */
  amount: number;
  /** targetStudents × amount */
  planned: number;
}

export interface AopClassRow {
  classId: string;
  className: string;
  targetStudents: number;
  planned: number;
  fees: AopClassFee[];
}

export interface AopSchoolRow {
  schoolId: string;
  schoolName: string;
  category: string;
  totalTargetStudents: number;
  planned: number;
  heads: { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }[];
  classes: AopClassRow[];
}

export interface AopCategoryRow {
  category: string;
  totalTargetStudents: number;
  planned: number;
  heads: { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }[];
  schools: AopSchoolRow[];
}

/** Canonical category order for the report sections */
const AOP_CATEGORY_ORDER = ['brac_academy', 'brac_primary', 'brac_secondary'];

@Injectable()
export class FinanceReportsService {
  constructor(
    @InjectRepository(StudentFee)
    private readonly feesRepo: Repository<StudentFee>,
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(AopTarget)
    private readonly aopRepo: Repository<AopTarget>,
    @InjectRepository(FeeStructure)
    private readonly structuresRepo: Repository<FeeStructure>,
    @InjectRepository(FeeHead)
    private readonly headsRepo: Repository<FeeHead>,
    @InjectRepository(SchoolClass)
    private readonly classesRepo: Repository<SchoolClass>,
    @InjectRepository(DcSchool)
    private readonly schoolsRepo: Repository<DcSchool>,
    @InjectRepository(AcademicYear)
    private readonly yearsRepo: Repository<AcademicYear>,
  ) {}

  private activeFees(schoolId: string, academicYearId: string, month?: number) {
    return this.feesRepo.find({
      where: {
        schoolId,
        academicYearId,
        ...(month ? { month } : {}),
      },
      relations: ['student', 'student.schoolClass', 'student.section'],
    });
  }

  // ---------- Collection Report ----------
  async collectionReport(
    schoolId: string,
    academicYearId: string,
    month?: number,
    classId?: string,
    sectionId?: string,
  ) {
    const fees = (await this.activeFees(schoolId, academicYearId, month)).filter(
      (f) =>
        f.student &&
        f.status !== StudentFeeStatus.CANCELLED &&
        (!classId || f.student.classId === classId) &&
        (!sectionId || f.student.sectionId === sectionId),
    );

    const baseAmount = toMoney(fees.reduce((s, f) => s + parseFloat(f.baseAmount), 0));
    const discountAmount = toMoney(fees.reduce((s, f) => s + parseFloat(f.discountAmount), 0));
    const payableAmount = toMoney(fees.reduce((s, f) => s + parseFloat(f.payableAmount), 0));
    const collected = toMoney(fees.reduce((s, f) => s + parseFloat(f.paidAmount), 0));

    return {
      baseAmount,
      discountAmount,
      payableAmount,
      collected,
      // Billed-but-uncollected; over-collection (advance/arrear) reports as zero
      outstanding: toMoney(Math.max(payableAmount - collected, 0)),
      studentCount: new Set(fees.map((f) => f.studentId)).size,
    };
  }

  // ---------- Due Report (student-wise, origin month preserved) ----------
  async dueReport(
    schoolId: string,
    academicYearId: string,
    classId?: string,
    sectionId?: string,
  ) {
    const fees = (await this.activeFees(schoolId, academicYearId)).filter(
      (f) =>
        f.student &&
        f.status !== StudentFeeStatus.CANCELLED &&
        (!classId || f.student.classId === classId) &&
        (!sectionId || f.student.sectionId === sectionId),
    );

    const byStudent = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        name: string;
        className: string;
        sectionName: string;
        payable: number;
        paid: number;
        due: number;
        months: { month: number; due: number; status: string }[];
      }
    >();

    for (const f of fees) {
      const due = toMoney(parseFloat(f.payableAmount) - parseFloat(f.paidAmount));
      let row = byStudent.get(f.studentId);
      if (!row) {
        row = {
          studentId: f.studentId,
          admissionNumber: f.student.admissionNumber,
          name: f.student.name,
          className: f.student.schoolClass?.name ?? '',
          sectionName: f.student.section?.name ?? '',
          payable: 0,
          paid: 0,
          due: 0,
          months: [],
        };
        byStudent.set(f.studentId, row);
      }
      row.payable = toMoney(row.payable + parseFloat(f.payableAmount));
      row.paid = toMoney(row.paid + parseFloat(f.paidAmount));
      row.due = toMoney(row.due + due);
      if (due > 0) {
        row.months.push({ month: f.month, due, status: f.status });
      }
    }

    const rows = [...byStudent.values()].filter((r) => r.due > 0);
    rows.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    return {
      rows,
      totalDue: toMoney(rows.reduce((s, r) => s + r.due, 0)),
    };
  }

  // ---------- Class-wise / Section-wise Collection ----------
  async groupedCollection(
    schoolId: string,
    academicYearId: string,
    month: number | undefined,
    groupBy: 'class' | 'section',
  ) {
    const fees = (await this.activeFees(schoolId, academicYearId, month)).filter(
      (f) => f.student && f.status !== StudentFeeStatus.CANCELLED,
    );

    if (groupBy === 'class') {
      const classes = await this.feesRepo.manager.find(SchoolClass, {
        where: { schoolId, deletedAt: IsNull() },
      });
      const map = new Map<string, { className: string; students: Set<string>; payable: number; collected: number }>();
      for (const f of fees) {
        if (!f.student || !f.classId) continue;
        let row = map.get(f.classId);
        if (!row) {
          row = {
            className: classes.find((c) => c.id === f.classId)?.name ?? 'Unknown',
            students: new Set<string>(),
            payable: 0,
            collected: 0,
          };
          map.set(f.classId, row);
        }
        row.students.add(f.studentId);
        row.payable = toMoney(row.payable + parseFloat(f.payableAmount));
        row.collected = toMoney(row.collected + parseFloat(f.paidAmount));
      }
      const rows = [...map.entries()]
        .map(([id, r]) => ({
          classId: id,
          className: r.className,
          students: r.students.size,
          payable: r.payable,
          collected: r.collected,
          due: toMoney(r.payable - r.collected),
        }))
        .sort((a, b) => a.className.localeCompare(b.className));
      return rows;
    }

    const sections = await this.feesRepo.manager.find(SchoolSection, {
      where: { deletedAt: IsNull() },
    });
    const map = new Map<
      string,
      { classId: string; sectionId: string; students: Set<string>; payable: number; collected: number }
    >();
    for (const f of fees) {
      if (!f.student || !f.classId || !f.sectionId) continue;
      const key = `${f.classId}:${f.sectionId}`;
      let row = map.get(key);
      if (!row) {
        row = {
          classId: f.classId,
          sectionId: f.sectionId,
          students: new Set<string>(),
          payable: 0,
          collected: 0,
        };
        map.set(key, row);
      }
      row.students.add(f.studentId);
      row.payable = toMoney(row.payable + parseFloat(f.payableAmount));
      row.collected = toMoney(row.collected + parseFloat(f.paidAmount));
    }
    return [...map.entries()].map(([key, r]) => ({
      key,
      classId: r.classId,
      sectionId: r.sectionId,
      students: r.students.size,
      payable: r.payable,
      collected: r.collected,
      due: toMoney(r.payable - r.collected),
    }));
  }

  // ---------- Fee Head Report ----------
  /**
   * Head-wise collected amounts for one fee from its completed payments.
   * Payments with explicit allocations contribute per head; legacy
   * month-level payments (no allocations) are distributed proportionally by
   * each head's payable share. Both kinds can coexist on one fee (old data +
   * newer allocations) — each payment is attributed independently, so no
   * collected money is lost to the other kind.
   */
  private headCollectedForFee(
    feePayments: Payment[] | undefined,
    breakdown: StudentFee['breakdown'],
  ): Map<string, number> {
    const paid = new Map<string, number>();
    const payableTotal = breakdown.reduce((s, b) => s + b.payable, 0);
    let legacyTotal = 0;

    for (const p of feePayments ?? []) {
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

  private paymentsByFeeId(fees: StudentFee[]): Promise<Payment[]> {
    const paymentRepo = this.feesRepo.manager.getRepository(Payment);
    return fees.length
      ? paymentRepo.find({
          where: { studentFeeId: In(fees.map((f) => f.id)), status: PaymentStatus.COMPLETED },
        })
      : Promise.resolve([]);
  }

  async feeHeadReport(schoolId: string, academicYearId: string, month?: number) {
    const fees = (await this.activeFees(schoolId, academicYearId, month)).filter(
      (f) => f.status !== StudentFeeStatus.CANCELLED,
    );

    const payments = await this.paymentsByFeeId(fees);
    const paymentsByFee = new Map<string, Payment[]>();
    for (const p of payments) {
      const list = paymentsByFee.get(p.studentFeeId) ?? [];
      list.push(p);
      paymentsByFee.set(p.studentFeeId, list);
    }

    // Generated vs collected: EVERY non-cancelled fee contributes its
    // base/discount/payable — months without any collection still belong to
    // the "generated" side and their payable belongs to "due".
    const map = new Map<string, { name: string; base: number; discount: number; payable: number; collected: number }>();
    for (const f of fees) {
      const collectedByHead = this.headCollectedForFee(paymentsByFee.get(f.id), f.breakdown ?? []);
      for (const line of f.breakdown ?? []) {
        let row = map.get(line.feeHeadId);
        if (!row) {
          row = { name: line.feeHeadName, base: 0, discount: 0, payable: 0, collected: 0 };
          map.set(line.feeHeadId, row);
        }
        row.base = toMoney(row.base + line.base);
        row.discount = toMoney(row.discount + line.discount);
        row.payable = toMoney(row.payable + line.payable);
        row.collected = toMoney(row.collected + (collectedByHead.get(line.feeHeadId) ?? 0));
      }
    }
    return [...map.values()]
      .map((r) => ({ ...r, due: toMoney(r.payable - r.collected) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---------- Planned vs Actual Revenue (auto-calculated) ----------
  /**
   * Planned vs actual revenue per fee head, month by month, auto-calculated
   * from the fee collection module:
   *   Planned  = payable amount generated on the student fee snapshots
   *   Actual   = collected amount (real payment allocations; legacy
   *              month-level payments distributed by payable share)
   *   Due      = planned − actual, % of collection = actual ÷ planned
   *   Deficit  = actual − planned (negative = shortfall vs plan)
   */
  async revenueReport(schoolId: string, academicYearId: string) {
    const fees = (await this.activeFees(schoolId, academicYearId)).filter(
      (f) => f.status !== StudentFeeStatus.CANCELLED,
    );

    // Real head-wise collected amounts from payments (allocations first, legacy
    // month-level payments distributed by payable share — mixed coexist)
    const payments = await this.paymentsByFeeId(fees);
    const paymentsByFee = new Map<string, Payment[]>();
    for (const p of payments) {
      const list = paymentsByFee.get(p.studentFeeId) ?? [];
      list.push(p);
      paymentsByFee.set(p.studentFeeId, list);
    }

    const heads = new Map<
      string,
      { feeHeadId: string; feeHeadName: string; months: Record<number, RevenueHeadCell>; total: RevenueHeadCell }
    >();
    const allMonths: { month: number; planned: number; collected: number; due: number }[] = Array.from(
      { length: 12 },
      (_, i) => ({ month: i + 1, planned: 0, collected: 0, due: 0 }),
    );

    for (const f of fees) {
      const collectedByHead = this.headCollectedForFee(paymentsByFee.get(f.id), f.breakdown ?? []);
      const monthRow = allMonths[f.month - 1];
      for (const line of f.breakdown ?? []) {
        let head = heads.get(line.feeHeadId);
        if (!head) {
          head = {
            feeHeadId: line.feeHeadId,
            feeHeadName: line.feeHeadName,
            months: {},
            total: { planned: 0, collected: 0, due: 0 },
          };
          heads.set(line.feeHeadId, head);
        }
        const collected = collectedByHead.get(line.feeHeadId) ?? 0;
        const cell = head.months[f.month] ?? { planned: 0, collected: 0, due: 0 };
        cell.planned = toMoney(cell.planned + line.payable);
        cell.collected = toMoney(cell.collected + collected);
        cell.due = toMoney(cell.planned - cell.collected);
        head.months[f.month] = cell;

        head.total.planned = toMoney(head.total.planned + line.payable);
        head.total.collected = toMoney(head.total.collected + collected);
        head.total.due = toMoney(head.total.planned - head.total.collected);

        monthRow.planned = toMoney(monthRow.planned + line.payable);
        monthRow.collected = toMoney(monthRow.collected + collected);
        monthRow.due = toMoney(monthRow.planned - monthRow.collected);
      }
    }

    const pct = (collected: number, planned: number) =>
      planned > 0 ? toMoney(Math.min(100, (collected / planned) * 100)) : null;

    const headRows = [...heads.values()]
      .map((h) => ({
        feeHeadId: h.feeHeadId,
        feeHeadName: h.feeHeadName,
        months: h.months,
        total: { ...h.total, collectionPct: pct(h.total.collected, h.total.planned) },
      }))
      .sort((a, b) => a.feeHeadName.localeCompare(b.feeHeadName));

    const monthRows = allMonths
      .filter((m) => m.planned > 0 || m.collected > 0)
      .map((m) => ({ ...m, collectionPct: pct(m.collected, m.planned) }));

    const totalPlanned = toMoney(monthRows.reduce((s, m) => s + m.planned, 0));
    const totalCollected = toMoney(monthRows.reduce((s, m) => s + m.collected, 0));
    const totalDue = toMoney(totalPlanned - totalCollected);

    return {
      heads: headRows,
      months: monthRows,
      totals: {
        planned: totalPlanned,
        collected: totalCollected,
        due: Math.max(totalDue, 0),
        collectionPct: pct(totalCollected, totalPlanned),
        // budget variance — negative means the plan was not met
        deficit: toMoney(totalCollected - totalPlanned),
      },
    };
  }

  // ---------- Student Fee Ledger ----------
  async studentLedger(studentId: string) {
    const fees = await this.feesRepo.find({
      where: { studentId },
      order: { month: 'ASC' },
      relations: ['academicYear'],
    });
    return fees.map((f) => ({
      id: f.id,
      academicYear: f.academicYear?.name,
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

  // ---------- Student Fee Report (list view) ----------
  async studentFeeReport(
    schoolId: string,
    academicYearId: string,
    classId?: string,
    sectionId?: string,
  ) {
    const students = await this.studentsRepo.find({
      where: {
        schoolId,
        academicYearId,
        deletedAt: IsNull(),
        status: In([StudentStatus.ACTIVE, StudentStatus.INACTIVE]),
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      relations: ['schoolClass', 'section'],
      order: { rollNumber: 'ASC', name: 'ASC' },
    });
    if (students.length === 0) return [];

    const fees = await this.feesRepo.find({
      where: { academicYearId, studentId: In(students.map((s) => s.id)) },
    });
    const byStudent = new Map<string, { payable: number; paid: number; due: number; status: Set<string> }>();
    for (const f of fees) {
      if (f.status === StudentFeeStatus.CANCELLED) continue;
      let row = byStudent.get(f.studentId);
      if (!row) {
        row = { payable: 0, paid: 0, due: 0, status: new Set() };
        byStudent.set(f.studentId, row);
      }
      row.payable = toMoney(row.payable + parseFloat(f.payableAmount));
      row.paid = toMoney(row.paid + parseFloat(f.paidAmount));
      row.due = toMoney(row.due + parseFloat(f.payableAmount) - parseFloat(f.paidAmount));
      row.status.add(f.status);
    }

    return students.map((s) => {
      const row = byStudent.get(s.id);
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        name: s.name,
        className: s.schoolClass?.name ?? '',
        sectionName: s.section?.name ?? '',
        status: s.status,
        payable: toMoney(row?.payable ?? 0),
        paid: toMoney(row?.paid ?? 0),
        due: toMoney(row?.due ?? 0),
feeStatus: row ? [...row.status].join(', ') : 'no fees generated',
      };
    });
  }

  /**
   * Year-effective per-student fee amounts, grouped by school+class.
   * Mirrors the fee-generation schedule rule: YEARLY heads are charged only
   * in January, HALF_YEARLY only in July, MONTHLY heads in every month the
   * grid defines them — so the sum over the grid equals what one planned
   * student would actually be charged over the year.
   */
  private headYearAmountsByClass(
    structures: FeeStructure[],
  ): Map<string, Map<string, { name: string; schedule: FeeSchedule; amount: number }>> {
    const byClass = new Map<string, Map<string, { name: string; schedule: FeeSchedule; amount: number }>>();
    for (const row of structures) {
      const head = row.feeHead;
      if (!head || !row.feeHeadId) continue;
      if (head.feeSchedule === FeeSchedule.YEARLY && row.month !== 1) continue;
      if (head.feeSchedule === FeeSchedule.HALF_YEARLY && row.month !== 7) continue;
      const key = `${row.schoolId}|${row.classId}`;
      const headsMap = byClass.get(key) ?? new Map<string, { name: string; schedule: FeeSchedule; amount: number }>();
      const current = headsMap.get(row.feeHeadId);
      headsMap.set(row.feeHeadId, {
        name: head.name,
        schedule: head.feeSchedule,
        amount: toMoney((current?.amount ?? 0) + parseFloat(row.amount)),
      });
      byClass.set(key, headsMap);
    }
    return byClass;
  }

  private sortClassFees(fees: AopClassFee[]): AopClassFee[] {
    return fees.slice().sort((a, b) => a.feeHeadName.localeCompare(b.feeHeadName));
  }

  /**
   * Planned Revenue Target report across ALL schools, grouped by the three
   * school categories. Pure plan arithmetic — AOP target students × the
   * category fee structure, no discounts, no relation to enrolled students.
   */
  async plannedRevenueReport(academicYearId: string): Promise<{
    academicYear: { id: string; name: string } | null;
    categories: AopCategoryRow[];
  }> {
    const year = await this.yearsRepo.findOne({ where: { id: academicYearId } });
    if (!year) throw new NotFoundException('Academic year not found');

    const schools = await this.schoolsRepo.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
    if (schools.length === 0) return { academicYear: { id: year.id, name: year.name }, categories: [] };
    const schoolIds = schools.map((s) => s.id);

    const classes = await this.classesRepo.find({
      where: { schoolId: In(schoolIds), deletedAt: IsNull(), isActive: true },
      order: { sequence: 'ASC', name: 'ASC' },
    });
    const targets = await this.aopRepo.find({
      where: { academicYearId, deletedAt: IsNull() },
    });
    const targetByClass = new Map(targets.map((t) => [t.classId, t.targetStudents]));
    const structures = await this.structuresRepo.find({
      where: { academicYearId, deletedAt: IsNull(), schoolId: In(schoolIds) },
      relations: ['feeHead'],
    });
    const feesByClass = this.headYearAmountsByClass(structures);

    const schoolRows: AopSchoolRow[] = schools.map((s) => {
      const classRows: AopClassRow[] = classes
        .filter((c) => c.schoolId === s.id)
        .map((c) => {
          const targetStudents = targetByClass.get(c.id) ?? 0;
          const fees: AopClassFee[] = [...(feesByClass.get(`${s.id}|${c.id}`) ?? new Map()).entries()].map(
            ([feeHeadId, f]) => ({
              feeHeadId,
              feeHeadName: f.name,
              feeSchedule: f.schedule,
              amount: f.amount,
              planned: toMoney(f.amount * targetStudents),
            }),
          );
          return {
            classId: c.id,
            className: c.name,
            targetStudents,
            planned: toMoney(fees.reduce((sum, f) => sum + f.planned, 0)),
            fees: this.sortClassFees(fees),
          };
        });

      const headsMap = new Map<string, { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }>();
      for (const cr of classRows) {
        for (const f of cr.fees) {
          const row = headsMap.get(f.feeHeadId);
          if (row) {
            row.planned = toMoney(row.planned + f.planned);
          } else {
            headsMap.set(f.feeHeadId, {
              feeHeadId: f.feeHeadId,
              feeHeadName: f.feeHeadName,
              feeSchedule: f.feeSchedule,
              planned: f.planned,
            });
          }
        }
      }

      return {
        schoolId: s.id,
        schoolName: s.name,
        category: s.schoolCategory ?? 'unknown',
        totalTargetStudents: classRows.reduce((sum, c) => sum + c.targetStudents, 0),
        planned: toMoney(classRows.reduce((sum, c) => sum + c.planned, 0)),
        heads: [...headsMap.values()].sort((a, b) => a.feeHeadName.localeCompare(b.feeHeadName)),
        classes: classRows,
      };
    });

    // Group schools by category, canonical order first, unknown categories last
    const byCategory = new Map<string, AopSchoolRow[]>();
    for (const row of schoolRows) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    const orderedCats = [
      ...AOP_CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...[...byCategory.keys()].filter((c) => !AOP_CATEGORY_ORDER.includes(c)),
    ];

    const categories: AopCategoryRow[] = orderedCats.map((cat) => {
      const rows = byCategory.get(cat) ?? [];
      const headsMap = new Map<string, { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }>();
      for (const school of rows) {
        for (const h of school.heads) {
          const row = headsMap.get(h.feeHeadId);
          if (row) {
            row.planned = toMoney(row.planned + h.planned);
          } else {
            headsMap.set(h.feeHeadId, { ...h });
          }
        }
      }
      return {
        category: cat,
        totalTargetStudents: rows.reduce((s, r) => s + r.totalTargetStudents, 0),
        planned: toMoney(rows.reduce((s, r) => s + r.planned, 0)),
        heads: [...headsMap.values()].sort((a, b) => a.feeHeadName.localeCompare(b.feeHeadName)),
        schools: rows,
      };
    });

    return { academicYear: { id: year.id, name: year.name }, categories };
  }

/**
   * AOP plan figures per school (target students × fee structure, no
   * discounts, independent of the enrolled student list). Consumed by the
   * Programme Overview so both the "Planned Revenue Target" and the
   * "Yearly Student Target" metrics use this pure plan baseline for all
   * three school categories.
   */
  async aopPlannedSummary(
    schoolIds: string[],
    academicYearName: number | string | null,
  ): Promise<Map<string, { planned: number; targetStudents: number }>> {
    const result = new Map<string, { planned: number; targetStudents: number }>();
    if (!academicYearName || schoolIds.length === 0) return result;

    const ay = await this.yearsRepo.findOne({ where: { name: String(academicYearName) } });
    if (!ay) return result;

    const targets = await this.aopRepo.find({
      where: { academicYearId: ay.id, schoolId: In(schoolIds), deletedAt: IsNull() },
    });
    if (targets.length === 0) return result;

    const structures = await this.structuresRepo.find({
      where: { academicYearId: ay.id, deletedAt: IsNull(), schoolId: In(schoolIds) },
      relations: ['feeHead'],
    });
    const feesByClass = this.headYearAmountsByClass(structures);

    for (const t of targets) {
      const row = result.get(t.schoolId) ?? { planned: 0, targetStudents: 0 };
      row.targetStudents += t.targetStudents;
      const heads = feesByClass.get(`${t.schoolId}|${t.classId}`);
      if (heads && heads.size > 0) {
        const perStudent = toMoney([...heads.values()].reduce((s, h) => s + h.amount, 0));
        row.planned = toMoney(row.planned + perStudent * t.targetStudents);
      }
      result.set(t.schoolId, row);
    }
    return result;
  }

  // ---------- Planned Revenue Target (AOP) ----------
  // The PLANNED baseline, fully independent of the enrolled student list:
  //   planned revenue = AOP target students × standard fee structure
  // No discounts are applied and live students are not considered at all.
  // (Live students with discounts produce the "Actual Revenue Target" of the
  // fee-collection module; payments received are the "Actual Collected".)

  /**
   * Class-wise AOP target students of one school for one academic year.
   * Used by the "Add AOP Target Students" form.
   */
  async aopTargets(schoolId: string, academicYearId: string) {
    const classes = await this.classesRepo.find({
      where: { schoolId, deletedAt: IsNull(), isActive: true },
      order: { sequence: 'ASC', name: 'ASC' },
    });
    const targets = await this.aopRepo.find({
      where: { schoolId, academicYearId, deletedAt: IsNull() },
    });
    const byClass = new Map(targets.map((t) => [t.classId, t.targetStudents]));
    return {
      classes: classes.map((c) => ({
        classId: c.id,
        className: c.name,
        targetStudents: byClass.get(c.id) ?? 0,
      })),
    };
  }

  /** Upserts the AOP target student counts of one school for one academic year. */
  async saveAopTargets(dto: SaveAopTargetsDto, userId: string) {
    if (dto.lines.length === 0) {
      throw new BadRequestException('No AOP target lines provided');
    }
    const classIds = [...new Set(dto.lines.map((l) => l.classId))];
    const classes = await this.classesRepo.find({
      where: { id: In(classIds), schoolId: dto.schoolId, deletedAt: IsNull() },
    });
    if (classes.length !== classIds.length) {
      throw new BadRequestException('One or more classes do not belong to this school');
    }
    const year = await this.yearsRepo.findOne({ where: { id: dto.academicYearId } });
    if (!year) throw new NotFoundException('Academic year not found');

    return this.feesRepo.manager.transaction(async (manager) => {
      const existing = await manager.find(AopTarget, {
        where: {
          schoolId: dto.schoolId,
          academicYearId: dto.academicYearId,
          classId: In(classIds),
        },
      });
      for (const line of dto.lines) {
        const current = existing.find((e) => e.classId === line.classId);
        if (current) {
          current.targetStudents = line.targetStudents;
          await manager.save(current);
        } else {
          await manager.save(
            manager.create(AopTarget, {
              schoolId: dto.schoolId,
              academicYearId: dto.academicYearId,
              classId: line.classId,
              targetStudents: line.targetStudents,
              createdById: userId,
            }),
          );
        }
      }
      const saved = await manager.find(AopTarget, {
        where: { schoolId: dto.schoolId, academicYearId: dto.academicYearId, deletedAt: IsNull() },
      });
      const byClass = new Map(saved.map((t) => [t.classId, t.targetStudents]));
      return {
        classes: classes
          .slice()
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name))
          .map((c) => ({
            classId: c.id,
            className: c.name,
            targetStudents: byClass.get(c.id) ?? 0,
          })),
      };
    });
  }
}
