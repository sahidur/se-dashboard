import { FeeStructure } from './entities/fee-structure.entity';
import { StudentDiscount, DiscountType } from './entities/student-discount.entity';
import { FeeSchedule, FeeApplicability, FeeHead } from './entities/fee-head.entity';
import { StudentFee } from '../fee-collection/entities/student-fee.entity';

export const MONTHS_IN_YEAR = 12;

// Month in which each periodic schedule is normally charged.
export const YEARLY_SCHEDULE_MONTH = 1;
export const HALF_YEARLY_SCHEDULE_MONTH = 7;

/**
 * Admission-date based fee rules (billing starts at the admission month,
 * Admission Fee for new students / Session Fee for existing students, catch-up
 * of yearly/half-yearly heads) are switched on with FEE_ADMISSION_RULES=on.
 * Until the one-off reconcile script has been reviewed and applied on a
 * database, the flag stays off and the legacy behaviour is untouched.
 */
export function isAdmissionRulesEnabled(): boolean {
  return (process.env.FEE_ADMISSION_RULES ?? '').trim().toLowerCase() === 'on';
}

/** Structural subsets, so the pure rules do not depend on entity classes. */
export interface FeeRuleStudent {
  admissionDate?: Date | string | null;
  studentType?: 'new' | 'existing' | null;
  studentTypeAcademicYearId?: string | null;
}
export interface FeeRuleYear {
  id: string;
  name?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}
export interface StudentFeeContext {
  /** 1-12, or null when the student is admitted after the year ends. */
  firstBillableMonth: number | null;
  /** New student for this academic year (drives Admission/Session fee). */
  isNew: boolean;
}

/** 'YYYY-MM-DD' from a date column value (string) or Date; null if unusable. */
export function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Academic years run January-December. Uses the stored start/end dates and
 * falls back to the calendar year given by a numeric year name ("2026").
 */
export function academicYearRange(year: FeeRuleYear): { start: string; end: string } | null {
  const start = toDateOnly(year.startDate);
  const end = toDateOnly(year.endDate);
  if (start && end) return { start, end };
  const n = /^\d{4}$/.test((year.name ?? '').trim()) ? year.name!.trim() : null;
  return n ? { start: `${n}-01-01`, end: `${n}-12-31` } : null;
}

/**
 * Resolves, for one student in one academic year:
 *  - firstBillableMonth: admission month if admitted inside the year; month 1
 *    if admitted before it (or the date is missing); none if after it. Whole
 *    months are billed - the day of the month never matters.
 *  - isNew: explicit override (only for the academic year it was set for),
 *    otherwise "admission date falls inside the academic year".
 */
export function resolveStudentFeeContext(
  student: FeeRuleStudent,
  year: FeeRuleYear,
): StudentFeeContext {
  const admission = toDateOnly(student.admissionDate);
  const range = academicYearRange(year);

  let firstBillableMonth: number | null = 1;
  let inYear = false;
  if (admission && range) {
    if (admission > range.end) {
      firstBillableMonth = null;
    } else if (admission >= range.start) {
      firstBillableMonth = Number(admission.slice(5, 7));
      inYear = true;
    }
  }

  const overrideApplies =
    !!student.studentType &&
    !!student.studentTypeAcademicYearId &&
    student.studentTypeAcademicYearId === year.id;
  const isNew = overrideApplies ? student.studentType === 'new' : inYear;

  return { firstBillableMonth, isNew };
}

export function headApplies(
  head: Pick<FeeHead, 'applicableTo'> | null | undefined,
  isNew: boolean,
): boolean {
  const rule = head?.applicableTo ?? FeeApplicability.ALL;
  if (rule === FeeApplicability.NEW_STUDENTS) return isNew;
  if (rule === FeeApplicability.EXISTING_STUDENTS) return !isNew;
  return true;
}

/** Month a periodic head is charged in; null for monthly heads. */
export function periodicScheduleMonth(
  head: Pick<FeeHead, 'feeSchedule'> | null | undefined,
): number | null {
  if (head?.feeSchedule === FeeSchedule.YEARLY) return YEARLY_SCHEDULE_MONTH;
  if (head?.feeSchedule === FeeSchedule.HALF_YEARLY) return HALF_YEARLY_SCHEDULE_MONTH;
  return null;
}

/**
 * The structure rows that make up one student's fee for one month.
 *
 * `structures` must hold the student's class rows for the whole academic year
 * (catch-up reads the row of the head's scheduled month). Without a context
 * (rules disabled) this is exactly the legacy selection.
 *
 * With a context:
 *  - nothing is charged before the first billable month;
 *  - heads are filtered by new/existing applicability;
 *  - a one-time annual head whose charge month has already passed when the
 *    student is admitted is charged in full in the first billable month.
 *    That is a yearly/half-yearly head at its scheduled month, or any head whose
 *    amount is set only under January in the fee structure (e.g. Admission Fee,
 *    Session Fee, Annual Fund), whatever its schedule says.
 */
export function selectStructureRows(
  structures: FeeStructure[],
  ctx: StudentFeeContext | null,
  month: number,
): FeeStructure[] {
  if (!ctx) {
    return structures.filter((s) => s.month === month && scheduleApplies(s, month));
  }
  const first = ctx.firstBillableMonth;
  if (first === null || month < first) return [];

  // Heads whose only structure row is in January are one-time annual charges.
  const monthsByHead = new Map<string, Set<number>>();
  for (const s of structures) {
    const set = monthsByHead.get(s.feeHeadId) ?? new Set<number>();
    set.add(s.month);
    monthsByHead.set(s.feeHeadId, set);
  }
  const januaryOnly = (headId: string) => {
    const months = monthsByHead.get(headId);
    return !!months && months.size === 1 && months.has(YEARLY_SCHEDULE_MONTH);
  };

  const picked = new Map<string, FeeStructure>();
  for (const s of structures) {
    if (!headApplies(s.feeHead, ctx.isNew)) continue;
    if (picked.has(s.feeHeadId)) continue;
    if (s.month === month && scheduleApplies(s, month)) {
      picked.set(s.feeHeadId, s);
    } else if (
      month === first &&
      s.month < month &&
      (periodicScheduleMonth(s.feeHead) === s.month || januaryOnly(s.feeHeadId))
    ) {
      picked.set(s.feeHeadId, s);
    }
  }
  return [...picked.values()];
}

export function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fee schedule is enforced at snapshot time: YEARLY heads are charged only
 * in January, HALF_YEARLY heads only in July — regardless of which months
 * the operator entered them in on the structure grid.
 */
export function scheduleApplies(row: FeeStructure, month: number): boolean {
  if (row.feeHead?.feeSchedule === FeeSchedule.YEARLY) return month === 1;
  if (row.feeHead?.feeSchedule === FeeSchedule.HALF_YEARLY) return month === 7;
  return true;
}

/**
 * Applies the student's active discounts for the given month to one fee
 * head's base amount. Head-level discounts apply to that head only;
 * total-level discounts distribute proportionally over the head amounts.
 * The head's discount is clamped to its base — a payable of zero is the
 * floor, so a mis-keyed discount can never push a breakdown line negative
 * (a negative line would poison head-wise allocation and dues totals).
 */
export function computeDiscount(
  discounts: StudentDiscount[],
  studentId: string,
  feeHeadId: string,
  headBase: number,
  month: number,
  allHeadBases: number[],
): number {
  const totalBase = allHeadBases.reduce((s, v) => s + v, 0);
  if (totalBase <= 0) return 0;

  let headLevel = 0;
  let totalLevel = 0;

  for (const d of discounts) {
    if (d.studentId !== studentId) continue;
    const applicable = d.isRecurring
      ? true
      : month >= (d.effectiveFromMonth ?? 1) && month <= (d.effectiveToMonth ?? MONTHS_IN_YEAR);
    if (!applicable) continue;

    const value = parseFloat(d.value);
    if (d.feeHeadId === feeHeadId) {
      headLevel += d.type === DiscountType.PERCENTAGE ? (headBase * value) / 100 : value;
    } else if (d.feeHeadId === null) {
      const amount =
        d.type === DiscountType.PERCENTAGE ? (totalBase * value) / 100 : value;
      totalLevel += amount * (headBase / totalBase);
    }
  }

  return toMoney(Math.min(headLevel + totalLevel, headBase));
}

export function buildBreakdown(
  rows: FeeStructure[],
  discounts: StudentDiscount[],
  studentId: string,
  month: number,
): StudentFee['breakdown'] {
  const headBases = rows.map((r) => parseFloat(r.amount));
  return rows.map((row) => {
    const base = parseFloat(row.amount);
    const discount = computeDiscount(
      discounts,
      studentId,
      row.feeHeadId,
      base,
      month,
      headBases,
    );
    return {
      feeHeadId: row.feeHeadId,
      feeHeadName: row.feeHead.name,
      base: toMoney(base),
      discount: toMoney(discount),
      payable: toMoney(base - discount),
    };
  });
}

/** Derived from the breakdown lines so the stored totals always equal the
 * sum of the per-head figures — rounding drift between the two would make
 * head-wise dues disagree with the month total. */
export function computeFeeTotals(breakdown: StudentFee['breakdown']): {
  baseAmount: number;
  discountAmount: number;
  payableAmount: number;
} {
  return {
    baseAmount: toMoney(breakdown.reduce((sum, b) => sum + b.base, 0)),
    discountAmount: toMoney(breakdown.reduce((sum, b) => sum + b.discount, 0)),
    payableAmount: toMoney(breakdown.reduce((sum, b) => sum + b.payable, 0)),
  };
}

/**
 * Field-wise breakdown comparison. Postgres jsonb does not preserve object
 * key order, so the stored lines cannot be compared with JSON.stringify —
 * compare the semantic values instead.
 */
export function breakdownEquals(
  a: StudentFee['breakdown'] | null | undefined,
  b: StudentFee['breakdown'] | null | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const x = left[i];
    const y = right[i];
    if (
      x.feeHeadId !== y.feeHeadId ||
      (x.feeHeadName ?? '') !== (y.feeHeadName ?? '') ||
      toMoney(x.base) !== toMoney(y.base) ||
      toMoney(x.discount) !== toMoney(y.discount) ||
      toMoney(x.payable) !== toMoney(y.payable)
    ) {
      return false;
    }
  }
  return true;
}
