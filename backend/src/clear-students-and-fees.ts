/**
 * One-off maintenance script: clears ALL student-list and fee data
 * across every school:
 *   - fee collection: receipts, payments, student fee snapshots
 *   - per-student discounts
 *   - student lists (edu_students + legacy students table)
 *   - fee structures (standard + data-collection) and their audit log
 *
 * Keeps schools, academic years, fee heads, classes/sections and
 * data-collection form data intact.
 *
 *   npm run students-fees:clear
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

// FK-safe order: children (payments/receipts/fees/discounts) before
// parents (students), audit log before structure is not required
// (log has no FK to structure) but is kept adjacent for clarity.
const TABLES = [
  'edu_receipts',
  'edu_payments',
  'edu_student_fees',
  'edu_student_discounts',
  'edu_students',
  'students',
  'edu_fee_structures',
  'dc_fee_structure_log',
  'dc_fee_structure',
];

async function run(): Promise<void> {
  // Boot without touching the schema (synchronize stays off like schema-sync).
  process.env.APP_ENV = 'production';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const table of TABLES) {
        const beforeRes = await qr.query(
          `SELECT COUNT(*)::int AS c FROM bep.${table}`,
        );
        const before = beforeRes?.[0]?.c ?? 0;
        await qr.query(`DELETE FROM bep.${table}`);
        console.log(`✅ ${table}: deleted ${before} row(s)`);
      }
      await qr.commitTransaction();
      console.log(
        'Done. Schools, academic years, fee heads, classes/sections and other data-collection data were kept.',
      );
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });