import { FeeStructure } from './entities/fee-structure.entity';
import { StudentDiscount, DiscountType } from './entities/student-discount.entity';
import { FeeSchedule } from './entities/fee-head.entity';
import { StudentFee } from '../fee-collection/entities/student-fee.entity';

export const MONTHS_IN_YEAR = 12;

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
