/**
 * One-off maintenance script: clears ALL fee-collection data
 * (student fee snapshots, payments, receipts) while keeping academic
 * years, fee heads, fee structures, students and discounts intact.
 *
 *   npm run fee-collection:clear
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const TABLES = ['edu_receipts', 'edu_payments', 'edu_student_fees'];

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
        const beforeRes = await qr.query(`SELECT COUNT(*)::int AS c FROM bep.${table}`);
        const before = beforeRes?.[0]?.c ?? 0;
        await qr.query(`DELETE FROM bep.${table}`);
        console.log(`✅ ${table}: deleted ${before} row(s)`);
      }
      await qr.commitTransaction();
      console.log('Done. Academic years, fee heads, fee structures, students and discounts were kept.');
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