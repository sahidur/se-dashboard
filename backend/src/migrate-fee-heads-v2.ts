/**
 * One-off migration: replaces the current fee heads with the canonical set
 * copied from the data-collection form `fee-structure-primary`
 * (frontend/src/app/(dashboard)/data-collection/forms/[slug]/page.tsx),
 * created once per school category (BRAC Academy / BRAC Primary / BRAC Secondary).
 *
 * 1. Ensures 9 fee heads exist per category (monthly + annual/session).
 * 2. Re-points fee structures + student fee breakdowns from the old
 *    heads (Tuition Fee / Exam Fee) to the new ones.
 * 3. Soft-deletes every old fee head once nothing references it.
 *
 * Run: npm run migrate:fee-heads-v2
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull, Not, In } from 'typeorm';
import { AppModule } from './app.module';
import { FeeHead } from './fee-management/entities/fee-head.entity';
import { DcSchool } from './data-collection/entities/dc-school.entity';
import { StudentFee } from './fee-collection/entities/student-fee.entity';

// Heads copied from the `fee-structure-primary` form
const NEW_HEADS: { name: string; description: string }[] = [
  { name: 'Monthly Tuition Fee', description: 'Monthly tuition charge' },
  { name: 'Development Fee', description: 'Monthly development charge' },
  { name: 'Tiffin Fee', description: 'Monthly tiffin charge' },
  { name: 'Transport Fee', description: 'Monthly transport charge' },
  { name: 'Admission Fee', description: 'Annual / session charge' },
  { name: 'Session Charge', description: 'Annual / session charge' },
  { name: 'Exam Fee', description: 'Annual / session examination charge' },
  { name: 'Annual Fund', description: 'Annual / session charge' },
  { name: 'Other Charges', description: 'Annual / session charge' },
];

const CATEGORIES = ['brac_academy', 'brac_primary', 'brac_secondary'] as const;

// Old head name → new head name (per category)
const RENAME_MAP: Record<string, string> = {
  'Tuition Fee': 'Monthly Tuition Fee',
  'Exam Fee': 'Exam Fee',
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const headsRepo = dataSource.getRepository(FeeHead);
    const schoolRepo = dataSource.getRepository(DcSchool);

    // 1. Ensure the new per-category heads exist
    const headByCategory = new Map<string, Map<string, FeeHead>>();
    const newIds = new Set<string>();
    for (const category of CATEGORIES) {
      const headsForCategory = new Map<string, FeeHead>();
      for (const spec of NEW_HEADS) {
        let head = await headsRepo.findOne({
          where: { name: spec.name, category },
        });
        if (!head) {
          head = await headsRepo.save(
            headsRepo.create({
              name: spec.name,
              category,
              description: spec.description,
              isActive: true,
            }),
          );
          console.log(`✅ Created fee head "${spec.name}" [${category}]`);
        } else if (head.description !== spec.description || !head.isActive) {
          // Reused head (e.g. old "Exam Fee") — sync description/active state
          head.description = spec.description;
          head.isActive = true;
          await headsRepo.save(head);
          console.log(`✅ Synced fee head "${spec.name}" [${category}]`);
        }
        newIds.add(head.id);
        headsForCategory.set(spec.name, head);
      }
      headByCategory.set(category, headsForCategory);
    }

    // 2. Re-point existing data to the new heads, per school category
    const schools = await schoolRepo.find({ where: { deletedAt: IsNull() } });
    for (const school of schools) {
      const newHeads = headByCategory.get(school.schoolCategory ?? '');
      if (!newHeads) continue;

      for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
        const oldHead = await headsRepo.findOne({
          where: { name: oldName, category: school.schoolCategory },
        });
        const newHead = newHeads.get(newName);
        if (!oldHead || !newHead || oldHead.id === newHead.id) continue;

        await dataSource.query(
          `UPDATE bep.edu_fee_structures SET fee_head_id = $1
           WHERE deleted_at IS NULL AND school_id = $2 AND fee_head_id = $3`,
          [newHead.id, school.id, oldHead.id],
        );

        const fees = await dataSource.getRepository(StudentFee).find({
          where: { schoolId: school.id },
        });
        let touched = 0;
        for (const fee of fees) {
          let changed = false;
          const breakdown = (fee.breakdown ?? []).map((line) => {
            if (line.feeHeadId === oldHead.id) {
              changed = true;
              return { ...line, feeHeadId: newHead.id, feeHeadName: newHead.name };
            }
            return line;
          });
          if (changed) {
            touched++;
            fee.breakdown = breakdown;
            await dataSource.getRepository(StudentFee).save(fee);
          }
        }
        if (touched > 0) {
          console.log(
            `✅ Remapped ${touched} fee rows of "${school.name}" → "${newName}" [${school.schoolCategory}]`,
          );
        }
      }
    }

    // 3. Soft-delete every old fee head that is not part of the new set
    const staleHeads = await headsRepo.find({
      where: { id: Not(In([...newIds])) },
    });
    for (const head of staleHeads) {
      const used = await dataSource.query(
        `SELECT 1 FROM bep.edu_fee_structures
         WHERE deleted_at IS NULL AND fee_head_id = $1 LIMIT 1`,
        [head.id],
      );
      if (used.length > 0) {
        console.log(`⚠️  Kept head "${head.name}" [${head.category ?? 'uncategorized'}] — still referenced by fee structures`);
        continue;
      }
      await headsRepo.softRemove(head);
      console.log(
        `✅ Soft-deleted old fee head "${head.name}" [${head.category ?? 'uncategorized'}]`,
      );
    }

    console.log('\n🎉 Fee head replacement completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();