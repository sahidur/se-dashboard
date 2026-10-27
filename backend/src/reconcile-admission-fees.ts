/**
 * Moves existing data to the admission-date fee rules, in one run:
 *   1. Fee heads: Admission Fee -> new students, Session Fee -> existing
 *      students (matched by name).
 *   2. Every student's fee rows: dues before the admission month are voided,
 *      unpaid months get the right heads, missing months are added. Rows with
 *      money collected are never changed - they become open items on the
 *      Fee Adjustments page for Finance.
 *
 *   npm run fees:reconcile                  preview only, writes nothing
 *   npm run fees:reconcile -- --apply       apply the changes
 *   npm run fees:reconcile -- --student=<admission number>   explain one student
 *   npm run fees:reconcile:prod [-- --apply]   same, from the compiled build
 *
 * Options: --school=<id> limit to one school, --out=<dir> CSV folder.
 * Safe to re-run: a second run finds nothing left to change.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { FeeReconcileService, ReconcileOptions } from './fee-collection/fee-reconcile.service';
import { isUUID } from 'class-validator';
import { Student } from './students/entities/student.entity';
import { StudentFee } from './fee-collection/entities/student-fee.entity';
import { AcademicYear } from './fee-management/entities/academic-year.entity';
import { FeeStructure } from './fee-management/entities/fee-structure.entity';
import { resolveStudentFeeContext } from './fee-management/fee-calculation';
import { FeeHead, FeeApplicability } from './fee-management/entities/fee-head.entity';

const flags = process.argv.slice(2);
const flagValue = (name: string) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = flags.includes('--apply');
const SCHOOL = flagValue('school');
const OUT_DIR = flagValue('out') ?? './reconcile-output';
const STUDENT = flagValue('student'); // admission number or id: explain one student

const csv = (cells: unknown[]) =>
  cells
    .map((v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');

/** Fee-head changes to make (admission/session by name). */
async function planHeadChanges(ds: DataSource) {
  const heads = await ds.getRepository(FeeHead).find();
  const changes: { head: FeeHead; applicableTo: FeeApplicability }[] = [];
  for (const head of heads) {
    if (head.applicableTo !== FeeApplicability.ALL) continue; // already configured
    const applicableTo = /admission/i.test(head.name)
      ? FeeApplicability.NEW_STUDENTS
      : /session/i.test(head.name)
        ? FeeApplicability.EXISTING_STUDENTS
        : FeeApplicability.ALL;
    if (applicableTo === FeeApplicability.ALL) continue;
    changes.push({ head, applicableTo });
  }
  return changes;
}

/** Explains, for one student, what the rules decide and what would change. */
async function inspectStudent(
  ds: DataSource,
  reconcile: FeeReconcileService,
  ref: string,
  opts: ReconcileOptions,
): Promise<number> {
  const student = await ds.getRepository(Student).findOne({
    where: isUUID(ref) ? { id: ref } : { admissionNumber: ref },
    withDeleted: true,
    relations: ['schoolClass', 'academicYear'],
  });
  if (!student) {
    console.log(`Student not found: ${ref}`);
    return 1;
  }
  console.log(`\nStudent ${student.name} (${student.admissionNumber})`);
  console.log(`  school/class     : ${student.schoolId} / ${student.schoolClass?.name ?? '-'}`);
  console.log(`  status           : ${student.status}`);
  console.log(`  admission date   : ${student.admissionDate ? String(student.admissionDate).slice(0, 10) : '(none)'}`);
  console.log(`  academic year    : ${student.academicYear?.name ?? '-'}`);
  console.log(`  student type set : ${student.studentType ?? '(automatic)'}` +
    (student.studentType ? ` for year ${student.studentTypeAcademicYearId}` : ''));

  const fees = await ds.getRepository(StudentFee).find({
    where: { studentId: student.id },
    order: { academicYearId: 'ASC', month: 'ASC' },
  });
  const yearIds = [...new Set([...fees.map((f) => f.academicYearId), student.academicYearId].filter(Boolean))] as string[];
  const years = yearIds.length ? await ds.getRepository(AcademicYear).find({ where: { id: In(yearIds) } }) : [];
  for (const y of years) {
    const ctx = resolveStudentFeeContext(student, y);
    console.log(`\nAcademic year ${y.name} (${y.status})`);
    console.log(`  first billable month : ${ctx.firstBillableMonth ?? 'none (admitted after the year)'}`);
    console.log(`  counted as           : ${ctx.isNew ? 'NEW student -> pays Admission Fee, not Session Fee' : 'OLD student -> pays Session Fee, not Admission Fee'}`);
    for (const f of fees.filter((x) => x.academicYearId === y.id)) {
      const heads = (f.breakdown ?? []).map((b) => ` ${b.payable}`).join(', ');
      console.log(`  month ${f.month}: ${f.status}, payable ${f.payableAmount}, paid ${f.paidAmount} [${heads}]`);
    }
    if (student.classId) {
      const rows = await ds.getRepository(FeeStructure).find({
        where: { schoolId: student.schoolId, academicYearId: y.id, classId: student.classId },
        relations: ['feeHead'],
      });
      const byHead = new Map<string, { head: FeeHead; months: number[] }>();
      for (const r of rows) {
        const e = byHead.get(r.feeHeadId) ?? { head: r.feeHead, months: [] };
        e.months.push(r.month);
        byHead.set(r.feeHeadId, e);
      }
      console.log('  heads in this class fee structure (charged to / schedule / months):');
      for (const { head, months } of byHead.values()) {
        const shown = opts.headOverrides?.get(head.id)?.applicableTo ?? head.applicableTo;
        console.log(`    ${head.name}: ${shown} / ${head.feeSchedule} / months ${months.sort((a, b) => a - b).join(',')}`);
      }
    }
  }

  const result = APPLY ? await reconcile.reconcileStudent(student.id, opts) : await reconcile.previewStudent(student.id, opts);
  console.log(`\n${APPLY ? 'Applied' : 'Would change'}: ${result.actions.length} action(s)`);
  for (const a of result.actions) {
    if (a.type === 'dismiss_flag') console.log(`  - close review item`);
    else if (a.type === 'flag') console.log(`  - month ${a.month}: FINANCE REVIEW ${a.kind} ${a.amount}`);
    else if (a.type === 'adjust_heads') console.log(`  - month ${a.month}: heads adjusted (added: ${a.added.join(', ') || '-'}; removed: ${a.removed.join(', ') || '-'}), payable ${a.previousPayable} -> ${a.payableAmount}`);
    else if (a.type === 'void') console.log(`  - month ${a.month}: void (${a.reason})`);
    else console.log(`  - month ${a.month}: ${a.type}`);
  }
  if (result.actions.length === 0) {
    console.log('  Nothing to change. If this is not what you expect, check the lines above:');
    console.log('  counted as NEW/OLD, and whether the Session/Admission heads exist for this class and month.');
  }
  return 0;
}

async function moneyTotals(ds: DataSource) {
  const schema = (ds.options as { schema?: string }).schema ?? 'public';
  const one = async (sql: string) => (await ds.query(sql))[0] as Record<string, string>;
  const p = await one(`SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM "${schema}"."edu_payments"`);
  const r = await one(`SELECT COUNT(*) n FROM "${schema}"."edu_receipts"`);
  const f = await one(`SELECT COALESCE(SUM(paid_amount),0) paid FROM "${schema}"."edu_student_fees"`);
  return { payments: Number(p.n), paymentsTotal: Number(p.total), receipts: Number(r.n), paidOnFees: Number(f.paid) };
}

async function run(): Promise<number> {
  // Never let TypeORM `synchronize` change the schema as a side effect.
  process.env.APP_ENV = 'production';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const reconcile = app.get(FeeReconcileService);
    console.log(APPLY ? 'APPLYING changes' : 'PREVIEW - nothing is written (add --apply to apply)');

    // 1. Fee heads
    const headChanges = await planHeadChanges(ds);
    console.log(`\nFee heads to configure: ${headChanges.length}`);
    for (const c of headChanges) {
      console.log(`  ${c.head.category ?? '-'} / ${c.head.name}: ${c.applicableTo}`);
    }
    const opts: ReconcileOptions = { actorId: null };
    if (APPLY) {
      for (const c of headChanges) {
        c.head.applicableTo = c.applicableTo;
        await ds.getRepository(FeeHead).save(c.head);
      }
    } else {
      // Show the effect of the head changes without saving them.
      opts.headOverrides = new Map(
        headChanges.map((c) => [c.head.id, { applicableTo: c.applicableTo }]),
      );
    }

    // One student only: explain and stop.
    if (STUDENT) return inspectStudent(ds, reconcile, STUDENT, opts);

    // 2. Student fee rows
    const before = await moneyTotals(ds);
    const ids = await reconcile.listStudentIds(SCHOOL);
    console.log(`\nChecking ${ids.length} students...`);

    const totals = { voided: 0, reinstated: 0, rebuilt: 0, adjusted: 0, created: 0, flagged: 0, dismissed: 0 };
    const changed: { studentId: string; actions: Awaited<ReturnType<typeof reconcile.previewStudent>>['actions'] }[] = [];
    const failed: string[] = [];
    let payableChange = 0;

    for (let i = 0; i < ids.length; i++) {
      try {
        const result = APPLY ? await reconcile.reconcileStudent(ids[i], opts) : await reconcile.previewStudent(ids[i], opts);
        if (result.actions.length) changed.push({ studentId: ids[i], actions: result.actions });
        for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += result.summary[k];
        for (const a of result.actions) {
          if (a.type === 'void') payableChange -= a.previousPayable;
          else if (a.type === 'rebuild' || a.type === 'reinstate' || a.type === 'adjust_heads') payableChange += parseFloat(a.payableAmount) - a.previousPayable;
          else if (a.type === 'create') payableChange += parseFloat(a.payableAmount);
        }
      } catch (error) {
        failed.push(`${ids[i]}: ${(error as Error)?.message ?? error}`);
      }
      if ((i + 1) % 500 === 0) console.log(`  ${i + 1}/${ids.length}`);
    }

    // 3. Review file for Finance
    const info = new Map<string, Student>();
    for (let i = 0; i < changed.length; i += 500) {
      const found = await ds.getRepository(Student).find({
        where: { id: In(changed.slice(i, i + 500).map((c) => c.studentId)) },
        withDeleted: true,
        relations: ['school', 'schoolClass'],
      });
      found.forEach((s) => info.set(s.id, s));
    }
    const lines = [csv(['school', 'class', 'admission_number', 'student', 'admission_date', 'month', 'action', 'old_payable', 'new_payable', 'note'])];
    for (const { studentId, actions } of changed) {
      const s = info.get(studentId);
      const who = [s?.school?.name, s?.schoolClass?.name, s?.admissionNumber, s?.name, s?.admissionDate ? String(s.admissionDate).slice(0, 10) : ''];
      for (const a of actions) {
        if (a.type === 'dismiss_flag') continue;
        if (a.type === 'flag') lines.push(csv([...who, a.month, 'NEEDS FINANCE REVIEW', '', a.amount, a.kind]));
        else if (a.type === 'create') lines.push(csv([...who, a.month, 'add month', '', a.payableAmount, '']));
        else lines.push(csv([...who, a.month, a.type === 'adjust_heads' ? 'heads adjusted (has payments)' : a.type, a.previousPayable, a.type === 'void' ? '0.00' : a.payableAmount, a.type === 'void' ? a.reason : a.type === 'adjust_heads' ? [a.added.length ? 'added: ' + a.added.join(' + ') : '', a.removed.length ? 'removed: ' + a.removed.join(' + ') : ''].filter(Boolean).join('; ') : '']));
      }
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `fee-migration-${APPLY ? 'applied' : 'preview'}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');

    console.log(`\nDues before the admission month removed : ${totals.voided}`);
    console.log(`Unpaid months corrected                 : ${totals.rebuilt + totals.reinstated}`);
    console.log(`Months with payments, heads adjusted    : ${totals.adjusted}`);
    console.log(`Months added for late admissions        : ${totals.created}`);
    console.log(`Items for Finance review (have payments): ${totals.flagged}`);
    console.log(`Change in outstanding dues              : ${payableChange.toFixed(2)}`);
    console.log(`Review file: ${path.resolve(file)}`);
    if (failed.length) {
      console.log(`\n${failed.length} student(s) could not be processed:`);
      failed.slice(0, 10).forEach((f) => console.log(`  ${f}`));
    }

    // 4. Money must be exactly as before.
    const after = await moneyTotals(ds);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      console.error('\nSTOP: payments, receipts or paid amounts changed. Restore the database backup and investigate.');
      return 1;
    }
    console.log('Check passed: payments, receipts and paid amounts are unchanged.');
    return failed.length ? 2 : 0;
  } finally {
    await app.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fee migration failed:', err);
    process.exit(1);
  });
