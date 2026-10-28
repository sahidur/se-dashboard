/**
 * One-off data fix: for every student in a class named "Play World" whose
 * admission date falls in 2025, set the admission date to 2026-01-01.
 * Students whose admission date is already in 2026 (or any other year) are
 * left untouched. Soft-deleted students are never touched.
 *
 *   npx ts-node -r tsconfig-paths/register src/fix-playworld-admission-date.ts            preview only, writes nothing
 *   npx ts-node -r tsconfig-paths/register src/fix-playworld-admission-date.ts --apply    apply the changes
 *
 * Safe to re-run: a second run finds nothing left to change.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const APPLY = process.argv.includes('--apply');

async function run(): Promise<number> {
  // Never let TypeORM `synchronize` change the schema as a side effect.
  process.env.APP_ENV = 'production';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const schema = (ds.options as { schema?: string }).schema ?? 'public';
    const q = (sql: string, params?: unknown[]) => ds.query(sql, params);

    console.log(APPLY ? 'APPLYING changes' : 'PREVIEW - nothing is written (add --apply to apply)');

    const counts = (await q(
      `SELECT
         COUNT(*) FILTER (WHERE s.admission_date >= '2025-01-01' AND s.admission_date < '2026-01-01') AS to_update,
         COUNT(*) FILTER (WHERE s.admission_date >= '2026-01-01' AND s.admission_date < '2027-01-01') AS already_2026,
         COUNT(*) FILTER (WHERE s.admission_date IS NULL) AS no_date,
         COUNT(*) FILTER (WHERE s.admission_date < '2025-01-01') AS older,
         COUNT(*) FILTER (WHERE s.admission_date >= '2027-01-01') AS newer
       FROM "${schema}"."edu_students" s
       JOIN "${schema}"."edu_classes" c ON c.id = s.class_id
       WHERE c.name = 'Play World' AND s.deleted_at IS NULL`,
    ))[0] as Record<string, string>;
    console.log(`\nStudents in class "Play World" (not soft-deleted):`);
    console.log(`  admission year 2025 (will become 2026-01-01) : ${counts.to_update}`);
    console.log(`  admission year 2026 (left untouched)         : ${counts.already_2026}`);
    console.log(`  no admission date                            : ${counts.no_date}`);
    console.log(`  other years (left untouched)                 : ${Number(counts.older) + Number(counts.newer)}`);

    const rows = (await q(
      `SELECT s.id, sc.name AS school, s.admission_number, s.name AS student,
              s.admission_date::text AS admission_date
       FROM "${schema}"."edu_students" s
       JOIN "${schema}"."edu_classes" c ON c.id = s.class_id
       LEFT JOIN "${schema}"."dc_schools" sc ON sc.id = s.school_id
       WHERE c.name = 'Play World' AND s.deleted_at IS NULL
         AND s.admission_date >= '2025-01-01' AND s.admission_date < '2026-01-01'
       ORDER BY sc.name, s.admission_number`,
    )) as { id: string; school: string; admission_number: string; student: string; admission_date: string }[];

    console.log(`\nStudents to update: ${rows.length}`);
    for (const r of rows) {
      console.log(`  [${r.school}] ${r.admission_number} ${r.student}: ${r.admission_date} -> 2026-01-01`);
    }

    if (!APPLY) {
      console.log('\nPreview only. Re-run with --apply to write the changes.');
      return 0;
    }

    await ds.transaction(async (tx) => {
      const result = await tx.query(
        `UPDATE "${schema}"."edu_students" s
         SET admission_date = '2026-01-01', updated_at = NOW()
         FROM "${schema}"."edu_classes" c
         WHERE c.id = s.class_id AND c.name = 'Play World' AND s.deleted_at IS NULL
           AND s.admission_date >= '2025-01-01' AND s.admission_date < '2026-01-01'`,
      );
      console.log(`\nUpdated ${result[1]} student(s).`);
    });

    // Idempotency check: nothing left with admission year 2025.
    const left = (await q(
      `SELECT COUNT(*) n
       FROM "${schema}"."edu_students" s
       JOIN "${schema}"."edu_classes" c ON c.id = s.class_id
       WHERE c.name = 'Play World' AND s.deleted_at IS NULL
         AND s.admission_date >= '2025-01-01' AND s.admission_date < '2026-01-01'`,
    ))[0] as { n: string };
    if (left.n !== '0') {
      console.error(`STOP: ${left.n} student(s) still have a 2025 admission date. Investigate.`);
      return 1;
    }
    console.log('Check passed: no "Play World" student has a 2025 admission date anymore.');
    return 0;
  } finally {
    await app.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
