/**
 * Demo data for the fee-collection module — lets you exercise the finance
 * report, programme overview and the school rating system end-to-end.
 *
 * What it does (single transaction):
 *  1. Sets demo fee-head schedules: "Admission Fee" → yearly (charged in
 *     January), "Session Fee"/"Session Charge" → half_yearly (July),
 *     tuition/tiffin heads → installment allowed.
 *  2. Builds the standard fee structure grid for the active academic year:
 *     every class × every month, amounts by school category (yearly heads
 *     only in January, half-yearly only in July).
 *  3. Generates the monthly student-fee snapshot for every active student
 *     for all 12 months, with student discounts applied.
 *  4. Collects payments head-by-head with realistic patterns — each school
 *     lands near a target collection rate (~92% / ~76% / ~58%) so the
 *     A/B/C rating bands are all visible. Some months stay unpaid so dues
 *     keep their origin month, and installment heads receive partial pay.
 *
 *   npm run demo:fees
 */
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AppModule } from './app.module';
import { FeeHead, FeeSchedule } from './fee-management/entities/fee-head.entity';
import { AcademicYear } from './fee-management/entities/academic-year.entity';
import { FeeStructure } from './fee-management/entities/fee-structure.entity';
import { StudentDiscount, DiscountType } from './fee-management/entities/student-discount.entity';
import { Student, StudentStatus } from './students/entities/student.entity';
import { StudentFee, StudentFeeStatus } from './fee-collection/entities/student-fee.entity';
import { Payment, PaymentMethod, PaymentStatus } from './fee-collection/entities/payment.entity';
import { Receipt, ReceiptStatus } from './fee-collection/entities/receipt.entity';
import { SchoolClass } from './students/entities/school-class.entity';

const toMoney = (v: number) => Math.round(v * 100) / 100;

/** Deterministic PRNG so re-running produces the same demo dataset. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base amounts (BDT) by fee-head name; anything unmatched falls back to 50. */
const AMOUNT_BY_HEAD: Record<string, number> = {
  'admission fee': 800,
  'admission form fee': 150,
  'annual fund': 200,
  'assessment fee': 80,
  'development fee': 100,
  'diary, badge, id card , syllabus, tie fee': 150,
  'exam fee': 100,
  'monthly tuition fee': 350,
  'tuition fee': 350,
  'other charges': 60,
  'session charge': 250,
  'session fee': 250,
  'sports fee': 60,
  'ssc registration fee': 500,
  'terminal assessment fee 1': 100,
  'terminal assessment fee 2': 100,
  'testimonial fee': 50,
  'tiffin fee': 300,
  'transport fee': 400,
  'project/ club activity fee': 80,
  'project/club activity fee': 80,
};

const amountFor = (headName: string, classIndex: number): number => {
  const base = AMOUNT_BY_HEAD[headName.trim().toLowerCase()] ?? 50;
  const scaled = base * (1 + classIndex * 0.08);
  return Math.max(10, Math.round(scaled / 5) * 5);
};

/** Collection-rate targets per school (sorted by name). Annual averages land
 *  near ~86% / ~72% / ~55% because Oct–Dec (future months) collect little,
 *  giving one school per A / B / C rating band. */
const RATE_BY_SCHOOL_INDEX = [1.08, 0.9, 0.68];

interface SchoolRow {
  id: string;
  name: string;
  school_category: string;
}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const year = await ds.getRepository(AcademicYear).findOne({ where: { name: String(new Date().getFullYear()) } });
    if (!year) throw new Error(`No "${new Date().getFullYear()}" academic year found`);

    const heads = await ds.getRepository(FeeHead).find({ where: { isActive: true, deletedAt: IsNull() } });
    const schools = (await ds.query(`SELECT id, name, school_category FROM bep.dc_schools ORDER BY name`)) as SchoolRow[];
    const students = await ds.getRepository(Student).find({
      where: { status: StudentStatus.ACTIVE, deletedAt: IsNull() },
      select: ['id', 'schoolId', 'classId', 'sectionId'],
    });
    const discounts = await ds.getRepository(StudentDiscount).find({
      where: { academicYearId: year.id, isActive: true },
    });
    const users = await ds.query(`SELECT id FROM bep.users ORDER BY "createdAt" LIMIT 1`);
    const userId: string = users[0]?.id;
    if (!userId) throw new Error('No user found for collected_by');

    const yearNum = parseInt(year.name, 10) || new Date().getFullYear();
    console.log(`Year ${year.name} • ${schools.length} schools • ${students.length} active students • ${heads.length} heads • ${discounts.length} discounts`);

    await ds.transaction(async (manager: EntityManager) => {
      // ── 1. Demo schedules on fee heads ──
      for (const h of heads) {
        const n = h.name.trim().toLowerCase();
        if (n === 'admission fee') h.feeSchedule = FeeSchedule.YEARLY;
        else if (n === 'session fee' || n === 'session charge') h.feeSchedule = FeeSchedule.HALF_YEARLY;
        if (n === 'tuition fee' || n === 'monthly tuition fee' || n === 'tiffin fee') h.installmentAllowed = true;
      }
      await manager.save(heads);

      // ── 2. Fee structure grid: school × year × class × month ──
      await manager.createQueryBuilder().delete().from(FeeStructure)
        .where('academic_year_id = :yid', { yid: year.id })
        .execute();

      const classes = await manager.find(SchoolClass, { where: { deletedAt: IsNull() }, order: { sequence: 'ASC' } });
      const classesBySchool = new Map<string, SchoolClass[]>();
      for (const c of classes) {
        const list = classesBySchool.get(c.schoolId) ?? [];
        list.push(c);
        classesBySchool.set(c.schoolId, list);
      }
      const classIndexByClass = new Map<string, number>();
      for (const [sid, list] of classesBySchool) {
        list.forEach((c, i) => classIndexByClass.set(`${sid}:${c.id}`, i));
      }

      const byHeadId = new Map(heads.map((h) => [h.id, h]));
      const structureRows: FeeStructure[] = [];
      for (const school of schools) {
        const schoolHeads = heads.filter((h) => !h.category || h.category === school.school_category);
        const schoolClasses = classesBySchool.get(school.id) ?? [];
        for (const [ci, cls] of schoolClasses.entries()) {
          for (let month = 1; month <= 12; month++) {
            for (const h of schoolHeads) {
              if (h.feeSchedule === FeeSchedule.YEARLY && month !== 1) continue;
              if (h.feeSchedule === FeeSchedule.HALF_YEARLY && month !== 7) continue;
              structureRows.push(manager.create(FeeStructure, {
                schoolId: school.id,
                academicYearId: year.id,
                classId: cls.id,
                month,
                feeHeadId: h.id,
                amount: amountFor(h.name, ci).toFixed(2),
                createdById: userId,
              }));
            }
          }
        }
      }
      for (let i = 0; i < structureRows.length; i += 500) {
        await manager.insert(FeeStructure, structureRows.slice(i, i + 500));
      }
      console.log(`Fee structure rows created: ${structureRows.length}`);

      // ── 3. Student-fee snapshots for all months ──
      // payments reference student fees → clear receipts, then payments, then fees
      await manager.createQueryBuilder().delete().from(Receipt).execute();
      await manager.createQueryBuilder().delete().from(Payment).execute();
      await manager.createQueryBuilder().delete().from(StudentFee)
        .where('academic_year_id = :yid', { yid: year.id })
        .execute();

      const structureByKey = new Map<string, FeeStructure[]>();
      for (const r of structureRows) {
        const key = `${r.schoolId}:${r.classId}:${r.month}`;
        (structureByKey.get(key) ?? structureByKey.set(key, []).get(key)!).push(r);
      }

      const feeRows: StudentFee[] = [];
      for (const student of students) {
        for (let month = 1; month <= 12; month++) {
          const rows = structureByKey.get(`${student.schoolId}:${student.classId}:${month}`) ?? [];
          if (rows.length === 0) continue;
          const breakdown = rows.map((row) => {
            const head = heads.find((h) => h.id === row.feeHeadId)!;
            const base = parseFloat(row.amount);
            const discount = computeDiscount(
              discounts,
              student.id,
              row.feeHeadId,
              base,
              month,
              rows.map((r) => parseFloat(r.amount)),
            );
            return {
              feeHeadId: row.feeHeadId,
              feeHeadName: head.name,
              base: toMoney(base),
              discount: toMoney(discount),
              payable: toMoney(base - discount),
            };
          });
          const baseAmount = toMoney(breakdown.reduce((s, b) => s + b.base, 0));
          const discountAmount = toMoney(breakdown.reduce((s, b) => s + b.discount, 0));
          const payableAmount = toMoney(baseAmount - discountAmount);
          if (payableAmount < 0) throw new Error('Discount exceeds fee');
          feeRows.push(manager.create(StudentFee, {
            id: randomUUID(),
            studentId: student.id,
            academicYearId: year.id,
            schoolId: student.schoolId,
            classId: student.classId,
            sectionId: student.sectionId,
            month,
            breakdown,
            baseAmount: baseAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            payableAmount: payableAmount.toFixed(2),
            paidAmount: '0.00',
            status: StudentFeeStatus.DUE,
          }));
        }
      }
      for (let i = 0; i < feeRows.length; i += 500) {
        await manager.insert(StudentFee, feeRows.slice(i, i + 500));
      }
      console.log(`Student fee rows created: ${feeRows.length}`);

      // ── 4. Payments (head-wise, realistic) ──
      const rand = mulberry32(20260923);
      const sortedSchools = [...schools].sort((a, b) => a.name.localeCompare(b.name));
      const rateBySchool = new Map(sortedSchools.map((s, i) => [s.id, RATE_BY_SCHOOL_INDEX[i] ?? 0.7]));

      const paymentsList: Payment[] = [];
      for (const fee of feeRows) {
        const payable = parseFloat(fee.payableAmount);
        if (payable <= 0) continue;
        const rate = rateBySchool.get(fee.schoolId) ?? 0.7;
        // Oct–Dec are mostly future months — very little collected there
        const payChance = fee.month >= 10 ? rate * 0.2 : rate + (rand() - 0.5) * 0.24;

        let targetAmount = 0;
        if (rand() < payChance) targetAmount = payable;
        else if (rand() < 0.35) targetAmount = toMoney(payable * (0.3 + rand() * 0.3));
        if (targetAmount <= 0) continue;
        targetAmount = Math.min(targetAmount, payable);

        // head-wise allocation: non-installment heads paid full first,
        // installment heads absorb the remainder (partial payment)
        const allocations: { feeHeadId: string; feeHeadName: string; amount: number }[] = [];
        let left = targetAmount;
        for (const line of fee.breakdown) {
          if (left <= 0.009) break;
          const head = heads.find((h) => h.id === line.feeHeadId)!;
          const pay = head.installmentAllowed
            ? Math.min(line.payable, left)
            : left + 0.009 >= line.payable
              ? line.payable
              : 0;
          if (pay <= 0) continue;
          allocations.push({ feeHeadId: line.feeHeadId, feeHeadName: head.name, amount: toMoney(pay) });
          left = toMoney(left - pay);
        }
        const amount = toMoney(allocations.reduce((s, a) => s + a.amount, 0));
        if (amount <= 0) continue;

        const day = 5 + Math.floor(rand() * 23);
        const methodRoll = rand();
        const method = methodRoll < 0.7 ? PaymentMethod.CASH : methodRoll < 0.85 ? PaymentMethod.BANK : PaymentMethod.MFS;

        paymentsList.push(manager.create(Payment, {
          id: randomUUID(),
          studentId: fee.studentId,
          studentFeeId: fee.id,
          schoolId: fee.schoolId,
          amount: amount.toFixed(2),
          allocations,
          paymentMethod: method,
          transactionRef: method !== PaymentMethod.CASH ? `TRX-${Math.floor(rand() * 1e8).toString().padStart(8, '0')}` : undefined,
          paymentDate: new Date(Date.UTC(parseInt(year.name, 10), fee.month - 1, day, 6, 30)),
          collectedById: userId,
          status: PaymentStatus.COMPLETED,
        }));
      }

      const savedPayments: Payment[] = paymentsList;
      for (let i = 0; i < paymentsList.length; i += 500) {
        await manager.insert(Payment, paymentsList.slice(i, i + 500));
      }

      // receipts with sequential numbers
      const receipts: Receipt[] = savedPayments.map((p, i) => manager.create(Receipt, {
        receiptNumber: `RCPT-${year.name}-${String(i + 1).padStart(6, '0')}`,
        paymentId: p.id,
        studentId: p.studentId,
        amount: p.amount,
        issuedById: userId,
        status: ReceiptStatus.ACTIVE,
      }));
      for (let i = 0; i < receipts.length; i += 500) {
        await manager.insert(Receipt, receipts.slice(i, i + 500));
      }
      console.log(`Payments created: ${savedPayments.length} • receipts: ${receipts.length}`);

      // ── 5. Update fee paid/status from completed payments (single bulk UPDATE) ──
      const paidByFee = new Map<string, number>();
      for (const p of savedPayments) {
        paidByFee.set(p.studentFeeId, toMoney((paidByFee.get(p.studentFeeId) ?? 0) + parseFloat(p.amount)));
      }
      const updates: string[] = [];
      for (const fee of feeRows) {
        const paid = paidByFee.get(fee.id) ?? 0;
        if (paid <= 0) continue;
        const payable = parseFloat(fee.payableAmount);
        const status = paid >= payable - 0.009
          ? StudentFeeStatus.PAID
          : paid > 0 ? StudentFeeStatus.PARTIAL : StudentFeeStatus.DUE;
        fee.paidAmount = paid.toFixed(2);
        fee.status = status;
        updates.push(`('${fee.id}'::uuid, ${paid}, '${status}'::"bep"."edu_student_fees_status_enum")`);
      }
      for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500).join(', ');
        await manager.query(
          `UPDATE bep.edu_student_fees AS f SET paid_amount = v.paid_amount, status = v.status ` +
          `FROM (VALUES ${chunk}) AS v(id, paid_amount, status) WHERE f.id = v.id`,
        );
      }
      console.log(`Fee rows updated with paid amounts: ${updates.length}`);

      // per-school summary
      for (const school of [...schools].sort((a, b) => a.name.localeCompare(b.name))) {
        const rows = feeRows.filter((f) => f.schoolId === school.id);
        const planned = rows.reduce((s, f) => s + parseFloat(f.payableAmount), 0);
        const paid = rows.reduce((s, f) => s + parseFloat(f.paidAmount), 0);
        console.log(
          `  ${school.name}: planned ৳${Math.round(planned).toLocaleString()} • collected ৳${Math.round(paid).toLocaleString()} • ${(planned > 0 ? (paid / planned) * 100 : 0).toFixed(1)}%`,
        );
      }
    });

    console.log('✅ Demo fee data created.');
  } finally {
    await app.close();
  }
}

/** Mirrors FeeCollectionService.computeDiscount. */
function computeDiscount(
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
      : month >= (d.effectiveFromMonth ?? 1) && month <= (d.effectiveToMonth ?? 12);
    if (!applicable) continue;
    const value = parseFloat(d.value);
    if (d.feeHeadId === feeHeadId) {
      discount += d.type === DiscountType.PERCENTAGE ? (headBase * value) / 100 : value;
    } else if (d.feeHeadId === null) {
      const share = headBase / totalBase;
      const amount = d.type === DiscountType.PERCENTAGE ? (totalBase * value) / 100 : value;
      totalDiscount += amount * share;
    }
  }
  return toMoney(discount + totalDiscount);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
