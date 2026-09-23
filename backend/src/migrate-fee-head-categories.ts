/**
 * One-off migration: scopes fee heads to school categories.
 *
 * 1. Drops the legacy DB-level UNIQUE constraint on edu_fee_heads.name
 *    (uniqueness is now per category, enforced in FeeManagementService).
 * 2. Adds the `category` column if the schema does not have it yet.
 * 3. Creates per-category copies of the demo heads (Tuition/Exam fee) for
 *    every school category that has schools, and re-points the fee
 *    structures + student fee breakdowns of those schools to the new heads.
 * 4. Soft-deletes the old uncategorized heads once nothing references them.
 *
 * Run: npm run migrate:fee-head-categories
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull } from 'typeorm';
import { AppModule } from './app.module';
import { FeeHead } from './fee-management/entities/fee-head.entity';
import { DcSchool } from './data-collection/entities/dc-school.entity';
import { StudentFee } from './fee-collection/entities/student-fee.entity';

const CATEGORIES = ['brac_academy', 'brac_primary', 'brac_secondary'] as const;

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);

    // 1. Drop the legacy unique constraint on name (if present)
    const uniqueConstraints: { conname: string }[] = await dataSource.query(
      `SELECT con.conname
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE nsp.nspname = 'bep'
         AND rel.relname = 'edu_fee_heads'
         AND con.contype = 'u'`,
    );
    for (const { conname } of uniqueConstraints) {
      await dataSource.query(
        `ALTER TABLE bep.edu_fee_heads DROP CONSTRAINT IF EXISTS "${conname}"`,
      );
      console.log(`✅ Dropped unique constraint "${conname}" on edu_fee_heads`);
    }

    // 2. Add the category column (idempotent)
    await dataSource.query(
      `ALTER TABLE bep.edu_fee_heads ADD COLUMN IF NOT EXISTS category varchar(50)`,
    );
    console.log('✅ category column present on edu_fee_heads');

    const headsRepo = dataSource.getRepository(FeeHead);
    const schoolRepo = dataSource.getRepository(DcSchool);

    // 3. For every category that actually has schools, ensure per-category
    //    copies of the demo heads exist.
    const headByCategory = new Map<string, Map<string, FeeHead>>();
    for (const category of CATEGORIES) {
      const schoolCount = await schoolRepo.count({
        where: { schoolCategory: category },
      });
      if (schoolCount === 0) continue;

      const headsForCategory = new Map<string, FeeHead>();
      for (const name of ['Tuition Fee', 'Exam Fee']) {
        let head = await dataSource
          .getRepository(FeeHead)
          .findOne({ where: { name, category } });
        if (!head) {
          head = await dataSource.getRepository(FeeHead).save(
            dataSource.getRepository(FeeHead).create({
              name,
              category,
              description: `Monthly ${name.toLowerCase()} (${category})`,
              isActive: true,
            }),
          );
          console.log(`✅ Created fee head "${name}" [${category}]`);
        }
        headsForCategory.set(name, head);
      }
      headByCategory.set(category, headsForCategory);
    }

    // 4. Remap fee structures + student fee breakdowns per school category
    const schools = await schoolRepo.find({
      where: { deletedAt: IsNull() },
    });
    for (const school of schools) {
      const category = school.schoolCategory;
      const headsForCategory = headByCategory.get(category ?? '');
      if (!headsForCategory) continue;

      // old uncategorized heads by name
      const legacyHeads = await dataSource.getRepository(FeeHead).find({
        where: { category: IsNull() },
      });
      const legacyByName = new Map(legacyHeads.map((h) => [h.name, h]));

      for (const [name, newHead] of headsForCategory) {
        const legacy = legacyByName.get(name);
        if (!legacy || legacy.id === newHead.id) continue;

        await dataSource.query(
          `UPDATE bep.edu_fee_structures SET fee_head_id = $1
           WHERE school_id = $2 AND fee_head_id = $3`,
          [newHead.id, school.id, legacy.id],
        );

        // Remap the breakdown jsonb on student fee rows of this school
        const fees = await dataSource.getRepository(StudentFee).find({
          where: { schoolId: school.id },
        });
        let touched = 0;
        for (const fee of fees) {
          let changed = false;
          const breakdown = (fee.breakdown ?? []).map((line) => {
            if (line.feeHeadId === legacy.id) {
              touched++;
              return { ...line, feeHeadId: newHead.id };
            }
            return line;
          });
          if (touched > 0) {
            fee.breakdown = breakdown;
            await dataSource.getRepository(StudentFee).save(fee);
          }
        }
        if (touched > 0) {
          console.log(
            `✅ Remapped ${touched} breakdown lines of "${school.name}" → "${name}" [${category}]`,
          );
        }
      }
    }

    // 5. Soft-delete the old uncategorized heads (no longer referenced)
    const stillUsed = await dataSource.query(
      `SELECT DISTINCT fee_head_id FROM bep.edu_fee_structures
       WHERE fee_head_id IN (SELECT id FROM bep.edu_fee_heads WHERE category IS NULL)`,
    );
    const usedIds = new Set(stillUsed.map((r: { fee_head_id: string }) => r.fee_head_id));
    const legacyHeads = await dataSource.getRepository(FeeHead).find({
      where: { category: IsNull() },
    });
    for (const head of legacyHeads) {
      if (usedIds.has(head.id)) continue;
      await dataSource.getRepository(FeeHead).softRemove(head);
      console.log(`✅ Soft-deleted legacy fee head "${head.name}"`);
    }

    console.log('\n🎉 Fee head category migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();