import { StudentFee, StudentFeeStatus } from './entities/student-fee.entity';
import { Payment } from './entities/payment.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import { StudentDiscount } from '../fee-management/entities/student-discount.entity';
import { FeeApplicability } from '../fee-management/entities/fee-head.entity';
import { FeeAdjustmentKind } from './entities/fee-adjustment.entity';
import {
  FeeRuleStudent,
  FeeRuleYear,
  StudentFeeContext,
  resolveStudentFeeContext,
  selectStructureRows,
  buildBreakdown,
  computeFeeTotals,
  breakdownEquals,
  headApplies,
  toMoney,
} from '../fee-management/fee-calculation';
import { computeHeadWisePaid } from './head-wise-paid';

export const VOID_SOURCE_ADMISSION_DATE = 'admission_date';
/** Rows cancelled because the student dropped out before that month. */
export const VOID_SOURCE_DROPOUT = 'dropout';

export interface PlannerFee {
  id: string;
  academicYearId: string;
  month: number;
  classId: string | null;
  sectionId: string | null;
  status: StudentFeeStatus;
  baseAmount: string;
  discountAmount: string;
  payableAmount: string;
  paidAmount: string;
  breakdown: StudentFee['breakdown'];
  voidSource: string | null;
  deleted: boolean;
  /** Completed (not cancelled) payments against this month. */
  payments: Payment[];
}

export interface PlannerInput {
  student: FeeRuleStudent & {
    id: string;
    schoolId: string;
    classId: string | null;
    sectionId: string | null;
    academicYearId: string | null;
    isActive: boolean;
  };
  years: FeeRuleYear[];
  fees: PlannerFee[];
  /** Class structure rows for the whole academic year(s), with feeHead loaded. */
  structures: FeeStructure[];
  discounts: StudentDiscount[];
  headApplicability: Map<string, FeeApplicability>;
  openAdjustments: { id: string; studentFeeId: string; kind: FeeAdjustmentKind }[];
  /** Highest month already generated for the student's class, per academic year. */
  latestGeneratedMonth: Map<string, number>;
  createMissing: boolean;
}

interface Totals {
  baseAmount: string;
  discountAmount: string;
  payableAmount: string;
}
interface Computed extends Totals {
  breakdown: StudentFee['breakdown'];
}

export type ReconcileAction =
  | {
      type: 'void';
      feeId: string;
      academicYearId: string;
      month: number;
      reason: string;
      previousPayable: number;
    }
  | ({
      type: 'reinstate';
      feeId: string;
      academicYearId: string;
      month: number;
      previousPayable: number;
    } & Computed)
  | ({
      type: 'rebuild';
      feeId: string;
      academicYearId: string;
      month: number;
      previousPayable: number;
    } & Computed)
  | ({
      type: 'adjust_heads';
      feeId: string;
      academicYearId: string;
      month: number;
      previousPayable: number;
      added: string[];
      removed: string[];
    } & Computed)
  | ({
      type: 'create';
      academicYearId: string;
      month: number;
      classId: string;
      sectionId: string | null;
    } & Computed)
  | {
      type: 'flag';
      feeId: string;
      academicYearId: string;
      month: number;
      kind: FeeAdjustmentKind;
      amount: number;
      details: Record<string, unknown>;
    }
  | { type: 'dismiss_flag'; adjustmentId: string; note: string };

function compute(
  structuresForClass: FeeStructure[],
  discounts: StudentDiscount[],
  ctx: StudentFeeContext,
  studentId: string,
  month: number,
): Computed {
  const rows = selectStructureRows(structuresForClass, ctx, month);
  const breakdown = rows.length ? buildBreakdown(rows, discounts, studentId, month) : [];
  const t = computeFeeTotals(breakdown);
  return {
    breakdown,
    baseAmount: t.baseAmount.toFixed(2),
    discountAmount: t.discountAmount.toFixed(2),
    payableAmount: t.payableAmount.toFixed(2),
  };
}

function collected(fee: PlannerFee): number {
  const paid = parseFloat(fee.paidAmount ?? '0') || 0;
  const completed = fee.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  return toMoney(Math.max(paid, completed));
}

/**
 * Decides, without touching the database, what must change so one student's
 * fee rows follow the admission-date rules.
 *
 * Money is never touched: months with payments keep their paid amount, payments
 * and receipts. For those months only the billed side may change (heads that
 * now apply are added, unpaid heads that no longer apply are dropped) and
 * anything that needs a Finance decision becomes a review flag. Months before
 * the admission month that already have payments are only flagged. Closed
 * academic years are skipped entirely.
 */
export function planStudentReconcile(input: PlannerInput): ReconcileAction[] {
  const { student } = input;
  const actions: ReconcileAction[] = [];
  const yearById = new Map(input.years.map((y) => [y.id, y]));
  const yearIds = new Set(input.fees.map((f) => f.academicYearId));
  if (student.academicYearId) yearIds.add(student.academicYearId);

  const wantedFlags = new Set<string>(); // `${feeId}|${kind}`
  const existingFlag = new Set(input.openAdjustments.map((a) => `${a.studentFeeId}|${a.kind}`));
  const pushFlag = (
    fee: PlannerFee,
    kind: FeeAdjustmentKind,
    amount: number,
    details: Record<string, unknown>,
  ) => {
    wantedFlags.add(`${fee.id}|${kind}`);
    if (existingFlag.has(`${fee.id}|${kind}`)) return;
    actions.push({
      type: 'flag',
      feeId: fee.id,
      academicYearId: fee.academicYearId,
      month: fee.month,
      kind,
      amount: toMoney(amount),
      details,
    });
  };

  for (const yearId of yearIds) {
    const year = yearById.get(yearId);
    if (!year || year.status === 'closed') continue;
    const ctx = resolveStudentFeeContext(student, year);
    const first = ctx.firstBillableMonth;
    const discounts = input.discounts.filter((d) => d.academicYearId === yearId);
    const feesOfYear = input.fees.filter((f) => f.academicYearId === yearId);
    const structuresOf = (classId: string | null) =>
      input.structures.filter((s) => s.academicYearId === yearId && s.classId === classId);

    for (const fee of feesOfYear) {
      if (fee.deleted) continue;
      const money = collected(fee);
      const beforeAdmission = first === null || fee.month < first;

      if (fee.status === StudentFeeStatus.CANCELLED) {
        if (
          !beforeAdmission &&
          fee.voidSource === VOID_SOURCE_ADMISSION_DATE &&
          money === 0
        ) {
          actions.push({
            type: 'reinstate',
            feeId: fee.id,
            academicYearId: yearId,
            month: fee.month,
            previousPayable: toMoney(parseFloat(fee.payableAmount)),
            ...compute(structuresOf(fee.classId), discounts, ctx, student.id, fee.month),
          });
        }
        continue;
      }

      if (beforeAdmission) {
        if (money === 0) {
          actions.push({
            type: 'void',
            feeId: fee.id,
            academicYearId: yearId,
            month: fee.month,
            previousPayable: toMoney(parseFloat(fee.payableAmount)),
            reason:
              first === null
                ? 'Student is admitted after this academic year ends'
                : `Student admitted in month ${first}; no dues before admission`,
          });
        } else {
          pushFlag(fee, FeeAdjustmentKind.PRE_ADMISSION_PAYMENT, money, {
            reason: 'Payment collected for a month before the admission month',
            firstBillableMonth: first,
            status: fee.status,
            payable: parseFloat(fee.payableAmount),
            paid: parseFloat(fee.paidAmount),
          });
        }
        continue;
      }

      // Month is billable.
      if (money === 0) {
        if (fee.status !== StudentFeeStatus.DUE) continue;
        const next = compute(structuresOf(fee.classId), discounts, ctx, student.id, fee.month);
        const unchanged =
          breakdownEquals(next.breakdown, fee.breakdown ?? []) &&
          toMoney(parseFloat(next.baseAmount)) === toMoney(parseFloat(fee.baseAmount)) &&
          toMoney(parseFloat(next.discountAmount)) === toMoney(parseFloat(fee.discountAmount)) &&
          toMoney(parseFloat(next.payableAmount)) === toMoney(parseFloat(fee.payableAmount));
        if (!unchanged) {
          actions.push({
            type: 'rebuild',
            feeId: fee.id,
            academicYearId: yearId,
            month: fee.month,
            previousPayable: toMoney(parseFloat(fee.payableAmount)),
            ...next,
          });
        }
        continue;
      }

      // Money already collected. Paid amounts, payments and receipts are never
      // touched; only the BILLED side changes:
      //  - an inapplicable head with nothing paid on it is dropped;
      //  - an applicable head the row lacks (e.g. Session Fee for an old
      //    student, or January-only heads for a late joiner) is added;
      //  - an inapplicable head that already has money stays and is flagged.
      const current = fee.breakdown ?? [];
      const headPaid = computeHeadWisePaid(current, fee.payments);
      const applicableOf = (headId: string) =>
        input.structures.find((s) => s.feeHeadId === headId)?.feeHead?.applicableTo ??
        input.headApplicability.get(headId) ??
        FeeApplicability.ALL;
      const inapplicable = (headId: string) =>
        !headApplies({ applicableTo: applicableOf(headId) }, ctx.isNew);

      const paidOn = (b: { feeHeadId: string }) => toMoney(headPaid.get(b.feeHeadId) ?? 0);
      const dropped = current.filter((b) => inapplicable(b.feeHeadId) && paidOn(b) <= 0.009);
      const kept = current.filter((b) => !dropped.includes(b));

      const expected = compute(structuresOf(fee.classId), discounts, ctx, student.id, fee.month);
      const have = new Set(kept.map((b) => b.feeHeadId));
      const ruleDriven = (headId: string) =>
        applicableOf(headId) !== FeeApplicability.ALL || (first! > 1 && fee.month === first);
      const added = expected.breakdown.filter(
        (b) => !have.has(b.feeHeadId) && ruleDriven(b.feeHeadId),
      );

      // Only adjust a row whose bill lines add up to its payable amount; an
      // inconsistent legacy row is left for a human rather than recomputed.
      const consistent =
        toMoney(current.reduce((s, b) => s + b.payable, 0)) ===
        toMoney(parseFloat(fee.payableAmount));
      if ((added.length || dropped.length) && consistent) {
        const nextBreakdown = [...kept, ...added];
        const t = computeFeeTotals(nextBreakdown);
        actions.push({
          type: 'adjust_heads',
          feeId: fee.id,
          academicYearId: yearId,
          month: fee.month,
          previousPayable: toMoney(parseFloat(fee.payableAmount)),
          added: added.map((b) => b.feeHeadName),
          removed: dropped.map((b) => b.feeHeadName),
          breakdown: nextBreakdown,
          baseAmount: t.baseAmount.toFixed(2),
          discountAmount: t.discountAmount.toFixed(2),
          payableAmount: t.payableAmount.toFixed(2),
        });
      }

      const paidInapplicable = kept.filter((b) => inapplicable(b.feeHeadId));
      if (paidInapplicable.length) {
        const lines = paidInapplicable.map((b) => ({
          feeHeadId: b.feeHeadId,
          feeHeadName: b.feeHeadName,
          payable: b.payable,
          paid: paidOn(b),
          due: toMoney(b.payable - paidOn(b)),
        }));
        pushFlag(
          fee,
          FeeAdjustmentKind.INAPPLICABLE_HEAD_PAYMENT,
          toMoney(lines.reduce((s, l) => s + l.paid, 0)),
          {
            reason: ctx.isNew
              ? 'Paid for a head that is for existing students, but the student is new for this year'
              : 'Paid for a head that is for new students, but the student is not new for this year',
            isNew: ctx.isNew,
            heads: lines,
            nowBilled: added.map((b) => ({ feeHeadName: b.feeHeadName, payable: b.payable })),
          },
        );
      }
    }
    // Late admission: create the months the rest of the class already has.
    const isCurrentYear = student.academicYearId === yearId;
    const latest = input.latestGeneratedMonth.get(yearId) ?? 0;
    if (
      input.createMissing &&
      isCurrentYear &&
      student.isActive &&
      student.classId &&
      first !== null
    ) {
      const taken = new Set(feesOfYear.map((f) => f.month)); // incl. voided/deleted rows
      for (let month = first; month <= latest; month++) {
        if (taken.has(month)) continue;
        actions.push({
          type: 'create',
          academicYearId: yearId,
          month,
          classId: student.classId,
          sectionId: student.sectionId,
          ...compute(structuresOf(student.classId), discounts, ctx, student.id, month),
        });
      }
    }
  }

  // Flags whose cause has gone away (e.g. the admission date was corrected).
  const processedFeeIds = new Set(
    input.fees
      .filter((f) => !f.deleted && yearById.has(f.academicYearId) && yearById.get(f.academicYearId)!.status !== 'closed')
      .map((f) => f.id),
  );
  for (const a of input.openAdjustments) {
    if (!processedFeeIds.has(a.studentFeeId)) continue;
    if (!wantedFlags.has(`${a.studentFeeId}|${a.kind}`)) {
      actions.push({
        type: 'dismiss_flag',
        adjustmentId: a.id,
        note: 'Condition no longer applies after reconciliation',
      });
    }
  }

  return actions;
}
