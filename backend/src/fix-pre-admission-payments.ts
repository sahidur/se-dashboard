/**
 * Cleans up payments that were recorded against months BEFORE a student's
 * admission month (the old behaviour billed every student from January).
 * It only ever acts on an explicit, human-approved plan file - never on its own
 * guess - and refuses any payment that is not really before the admission month.
 *
 *   plan file (CSV), one payment per line:   receipt_number,action[,target_month]
 *       RCPT-2026-000123,CANCEL
 *       RCPT-2026-000456,MOVE,3
 *
 *   npm run fees:fix-pre-admission-payments -- --plan=plan.csv --user=admin@example.org           preview, writes nothing
 *   npm run fees:fix-pre-admission-payments -- --plan=plan.csv --user=admin@example.org --apply   apply
 *
 * CANCEL = the app's own "Cancel payment": payment and receipt are marked
 *          Cancelled with a reason and who did it; nothing is deleted and the
 *          receipt number stays in the sequence. Cancelled money is excluded
 *          from every total, due and report.
 * MOVE   = the same payment (same receipt, same amount) is applied to the
 *          admission month or a later month; both months' paid amounts are
 *          recalculated.
 * Afterwards each student is reconciled, which voids the now-empty months
 * before admission and closes their Fee Adjustments items. Every write goes
 * through the ORM, so it is recorded in audit_logs. Safe to re-run.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, In } from 'typeorm';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { FeeCollectionService } from './fee-collection/fee-collection.service';
import { FeeReconcileService } from './fee-collection/fee-reconcile.service';
import { Receipt } from './fee-collection/entities/receipt.entity';
import { Payment, PaymentStatus } from './fee-collection/entities/payment.entity';
import { StudentFee, StudentFeeStatus } from './fee-collection/entities/student-fee.entity';
import { Student } from './students/entities/student.entity';
import { AcademicYear } from './fee-management/entities/academic-year.entity';
import { User } from './users/entities/user.entity';
import { resolveStudentFeeContext, toMoney } from './fee-management/fee-calculation';
import { computeHeadWisePaid } from './fee-collection/head-wise-paid';
import { parsePlan, PlanItem } from './fee-collection/pre-admission-plan';

const flags = process.argv.slice(2);
const flagValue = (name: string) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = flags.includes('--apply');
const PLAN_FILE = flagValue('plan');
const USER_EMAIL = flagValue('user');

interface Resolved {
  item: PlanItem;
  payment: Payment;
  receiptStatus: string;
  fee: StudentFee;
  student: Student;
  firstBillable: number;
  target?: StudentFee;
  problem?: string;
  alreadyDone?: boolean;
  note?: string;
  /** MOVE with a named head: the payment is re-pointed at that head. */
  newAllocations?: { feeHeadId: string; feeHeadName: string; amount: number }[];
}

const derive = (payable: number, paid: number) =>
  paid >= payable ? StudentFeeStatus.PAID : paid > 0 ? StudentFeeStatus.PARTIAL : StudentFeeStatus.DUE;

/** Totals for the whole system, or only for the given students (the live system keeps collecting payments while this runs). */
async function moneyTotals(ds: DataSource, studentIds?: string[]) {
  const schema = (ds.options as { schema?: string }).schema ?? 'public';
  const scope = studentIds ? `AND student_id = ANY('{${studentIds.join(',')}}'::uuid[])` : '';
  const feeScope = studentIds ? `AND student_id = ANY('{${studentIds.join(',')}}'::uuid[])` : '';
  const one = async (sql: string) => (await ds.query(sql))[0] as Record<string, string>;
  const done = await one(`SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM "${schema}"."edu_payments" WHERE status='completed' ${scope}`);
  const all = await one(`SELECT COUNT(*) n FROM "${schema}"."edu_payments" WHERE true ${scope}`);
  const rc = await one(`SELECT COUNT(*) n FROM "${schema}"."edu_receipts" WHERE true ${scope}`);
  const fees = await one(`SELECT COALESCE(SUM(paid_amount) FILTER (WHERE status <> 'cancelled' AND deleted_at IS NULL),0) paid, COALESCE(SUM(payable_amount) FILTER (WHERE status <> 'cancelled' AND deleted_at IS NULL),0) payable, COALESCE(SUM(paid_amount) FILTER (WHERE status = 'cancelled'),0) paid_on_cancelled FROM "${schema}"."edu_student_fees" WHERE true ${feeScope}`);
  return {
    completedPayments: Number(done.n),
    completedTotal: Number(done.total),
    allPaymentRecords: Number(all.n),
    receiptRecords: Number(rc.n),
    paidOnActiveMonths: Number(fees.paid),
    payableOnActiveMonths: Number(fees.payable),
    paidOnCancelledMonths: Number(fees.paid_on_cancelled),
  };
}

async function run(): Promise<number> {
  if (!PLAN_FILE || !USER_EMAIL) {
    console.error('Usage: --plan=<file.csv> --user=<email of the person approving> [--apply]');
    return 1;
  }
  const items = parsePlan(fs.readFileSync(PLAN_FILE, 'utf8'));
  process.env.APP_ENV = 'production'; // never let TypeORM synchronize the schema

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const feeCollection = app.get(FeeCollectionService);
    const reconcile = app.get(FeeReconcileService);
    console.log(APPLY ? 'APPLYING changes' : 'PREVIEW - nothing is written (add --apply to apply)');

    const user = await ds.getRepository(User).findOne({ where: { email: USER_EMAIL } });
    if (!user) {
      console.error(`User ${USER_EMAIL} not found: it is recorded as the person who cancelled the payments.`);
      return 1;
    }

    // ---- resolve and validate every plan line ----
    const receipts = await ds.getRepository(Receipt).find({
      where: { receiptNumber: In(items.map((i) => i.receiptNumber)) },
      relations: ['payment'],
    });
    const byNumber = new Map(receipts.map((r) => [r.receiptNumber, r]));
    const resolved: Resolved[] = [];
    // head-wise room already used on a target month by earlier MOVEs in this plan
    const reserved = new Map<string, Map<string, number>>();

    for (const item of items) {
      const receipt = byNumber.get(item.receiptNumber);
      if (!receipt?.payment) {
        console.error(`Line ${item.line}: ${item.receiptNumber} not found`);
        return 1;
      }
      const payment = receipt.payment;
      const fee = await ds.getRepository(StudentFee).findOneOrFail({ where: { id: payment.studentFeeId }, withDeleted: true });
      const student = await ds.getRepository(Student).findOneOrFail({ where: { id: payment.studentId }, withDeleted: true });
      const year = await ds.getRepository(AcademicYear).findOneOrFail({ where: { id: fee.academicYearId }, withDeleted: true });
      const ctx = resolveStudentFeeContext(student, year);
      const r: Resolved = { item, payment, receiptStatus: receipt.status, fee, student, firstBillable: ctx.firstBillableMonth ?? 99 };

      if (year.status === 'closed') r.problem = 'academic year is closed';
      else if (payment.status !== PaymentStatus.COMPLETED) { r.alreadyDone = true; r.note = `already ${payment.status}`; }
      else if (ctx.firstBillableMonth !== null && fee.month >= ctx.firstBillableMonth) {
        r.problem = `month ${fee.month} is not before the admission month ${ctx.firstBillableMonth} - refusing`;
      } else if (item.action === 'MOVE') {
        const first = ctx.firstBillableMonth;
        if (first === null || item.targetMonth! < first) r.problem = 'target month is before the admission month';
        else {
          const target = await ds.getRepository(StudentFee).findOne({
            where: { studentId: student.id, academicYearId: fee.academicYearId, month: item.targetMonth! },
          });
          if (!target || target.status === StudentFeeStatus.CANCELLED) r.problem = `no usable fee row for month ${item.targetMonth}`;
          else {
            r.target = target;
            const completed = await ds.getRepository(Payment).find({ where: { studentFeeId: target.id, status: PaymentStatus.COMPLETED } });
            const paidBy = computeHeadWisePaid(target.breakdown ?? [], completed);
            const used = reserved.get(target.id) ?? new Map<string, number>();
            let allocations = payment.allocations?.length ? payment.allocations : null;
            if (item.reallocateHead) {
              const line = (target.breakdown ?? []).find(
                (b) => b.feeHeadName.trim().toLowerCase() === item.reallocateHead!.toLowerCase(),
              );
              if (!line) r.problem = `month ${target.month} has no "${item.reallocateHead}" line`;
              else {
                allocations = [{ feeHeadId: line.feeHeadId, feeHeadName: line.feeHeadName, amount: parseFloat(payment.amount) }];
                r.newAllocations = allocations;
              }
            }
            if (!r.problem && !allocations) {
              const room = parseFloat(target.payableAmount) - parseFloat(target.paidAmount) - [...used.values()].reduce((a, b) => a + b, 0);
              if (room + 0.001 < parseFloat(payment.amount)) r.problem = `month ${target.month} has only ${room.toFixed(2)} left to pay`;
              else used.set('_all', (used.get('_all') ?? 0) + parseFloat(payment.amount));
            } else if (!r.problem && allocations) {
              for (const a of allocations) {
                const line = (target.breakdown ?? []).find((b) => b.feeHeadId === a.feeHeadId);
                const left = line ? line.payable - (paidBy.get(a.feeHeadId) ?? 0) - (used.get(a.feeHeadId) ?? 0) : 0;
                if (!line) { r.problem = `month ${target.month} has no "${a.feeHeadName}" line`; break; }
                if (left + 0.001 < a.amount) { r.problem = `"${a.feeHeadName}" in month ${target.month} has only ${left.toFixed(2)} left (needs ${a.amount})`; break; }
                used.set(a.feeHeadId, (used.get(a.feeHeadId) ?? 0) + a.amount);
              }
            }            if (!r.problem) reserved.set(target.id, used);
          }
        }
      }
      resolved.push(r);
    }

    // ---- show the plan ----
    const affected = [...new Set(resolved.map((r) => r.student.id))];
    const before = await moneyTotals(ds, affected);
    console.log(`\nMoney of the ${affected.length} affected students, before:`, before);
    let cancelSum = 0;
    let moveSum = 0;
    console.log('\nreceipt              student                    admitted   from  action   amount   result');
    for (const r of resolved) {
      const amt = parseFloat(r.payment.amount);
      const base = `${r.item.receiptNumber}  ${r.student.admissionNumber.padEnd(24)}  ${String(r.student.admissionDate).slice(0, 10)}  m${String(r.fee.month).padEnd(3)}${r.item.action.padEnd(7)}${r.item.targetMonth ? ' ->m' + r.item.targetMonth + (r.item.reallocateHead ? '*' : '') : '    '}  ${amt.toFixed(2).padStart(8)}`;
      if (r.problem) console.log(`${base}  STOP: ${r.problem}`);
      else if (r.alreadyDone) console.log(`${base}  skip (${r.note})`);
      else {
        console.log(`${base}  ok`);
        if (r.item.action === 'CANCEL') cancelSum += amt; else moveSum += amt;
      }
    }
    const problems = resolved.filter((r) => r.problem);
    console.log(`\nWill cancel : ${cancelSum.toFixed(2)}`);
    console.log(`Will move   : ${moveSum.toFixed(2)}  (total unchanged)`);
    console.log(`These students' completed payments after: ${(before.completedTotal - cancelSum).toFixed(2)}  (now ${before.completedTotal.toFixed(2)})`);
    const systemBefore = await moneyTotals(ds);
    console.log(`Whole system now: ${systemBefore.completedTotal.toFixed(2)} collected, ${systemBefore.completedPayments} payments (live - it keeps changing as staff collect)`);
    if (problems.length) {
      console.error(`\n${problems.length} item(s) cannot be applied. Fix the plan first; nothing was changed.`);
      return 1;
    }
    if (!APPLY) {
      console.log('\nPreview only. Re-run with --apply after a database backup.');
      return 0;
    }

    // ---- apply, one student at a time ----
    const students = [...new Set(resolved.filter((r) => !r.alreadyDone).map((r) => r.student.id))];
    for (const studentId of students) {
      for (const r of resolved.filter((x) => x.student.id === studentId && !x.alreadyDone)) {
        if (r.item.action === 'CANCEL') {
          await feeCollection.cancelPayment(
            r.payment.id,
            `Recorded against a month before the student's admission month (duplicate/invalid). Cancelled by fee migration, approved by ${USER_EMAIL}.`,
            user.id,
          );
        } else {
          await ds.transaction(async (m) => {
            const payment = await m.findOneOrFail(Payment, { where: { id: r.payment.id }, lock: { mode: 'pessimistic_write' } });
            if (payment.status !== PaymentStatus.COMPLETED || payment.studentFeeId === r.target!.id) return;
            const source = await m.findOneOrFail(StudentFee, { where: { id: payment.studentFeeId }, lock: { mode: 'pessimistic_write' } });
            const target = await m.findOneOrFail(StudentFee, { where: { id: r.target!.id }, lock: { mode: 'pessimistic_write' } });
            payment.studentFeeId = target.id;
            if (r.newAllocations) payment.allocations = r.newAllocations;
            await m.save(payment);
            for (const fee of [source, target]) {
              const row = await m
                .createQueryBuilder(Payment, 'p')
                .select('COALESCE(SUM(p.amount),0)', 'total')
                .where('p.student_fee_id = :id', { id: fee.id })
                .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
                .getRawOne();
              const paid = toMoney(parseFloat(row.total));
              fee.paidAmount = paid.toFixed(2);
              fee.status = derive(parseFloat(fee.payableAmount), paid);
              await m.save(fee);
            }
          });
        }
      }
      // Voids the now-empty months before admission and closes their review items.
      await reconcile.reconcileStudent(studentId, { actorId: user.id });
    }

    // ---- verify ----
    const after = await moneyTotals(ds, affected);
    console.log('\nMoney of the affected students, after: ', after);
    const ok =
      Math.abs(after.completedTotal - (before.completedTotal - cancelSum)) < 0.01 &&
      after.allPaymentRecords === before.allPaymentRecords &&
      after.receiptRecords === before.receiptRecords;
    if (!ok) {
      console.error('\nSTOP: totals do not match the plan. Restore the backup and investigate.');
      return 1;
    }
    console.log('\nCheck passed: totals changed exactly by the cancelled amount; no payment or receipt record was deleted.');
    return 0;
  } finally {
    await app.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
