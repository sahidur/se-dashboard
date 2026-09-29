/**
 * One-off maintenance script: clears ALL data-collection form data for
 * every school (basic info, students, teachers, infrastructure, performance,
 * revenue budget/actual forms, fee structures, drafts, audit logs).
 *
 * Keeps the dc_schools registry itself (the "My Schools" list), surveys,
 * school monitoring submissions, schools, users and academic years intact.
 *
 *   npm run data-collection:clear
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const TABLES = [
  'dc_form_drafts',
  'dc_fee_structure_log',
  'dc_fee_structure',
  'dc_revenue_actual_monthly',
  'dc_revenue_actual_total',
  'dc_revenue_budget_monthly',
  'dc_revenue_budget_total',
  'dc_revenue',
  'dc_activity_participation',
  'dc_alumni',
  'dc_basic_information',
  'dc_cocurricular',
  'dc_event_participation',
  'dc_infrastructure',
  'dc_performance',
  'dc_pedagogical_achievement',
  'dc_student_performance',
  'dc_students_info',
  'dc_students_performance',
  'dc_teacher_individual',
  'dc_teachers_development',
  'dc_teachers_info',
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
        'Done. The dc_schools registry ("My Schools" list) and everything outside data-collection forms was kept.',
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