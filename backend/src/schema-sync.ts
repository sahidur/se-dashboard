/**
 * Production schema sync.
 *
 * TypeORM `synchronize` is deliberately off outside development (app.module.ts),
 * so entity changes never reach the production database on their own. This
 * script asks TypeORM for the DDL it *would* run, then applies only the
 * additive statements (new tables, new columns, new indexes/constraints).
 *
 * Anything destructive (DROP / ALTER COLUMN TYPE / RENAME) is printed and
 * skipped so a human can review it — those need a data-preserving migration.
 *
 *   node dist/schema-sync.js --check   # dry run, prints pending DDL only
 *   node dist/schema-sync.js           # applies the additive statements
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const ADDITIVE =
  /^(CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX|CREATE TYPE|CREATE SEQUENCE|ALTER TABLE .* ADD )/i;

async function run(): Promise<number> {
  const checkOnly = process.argv.includes('--check');

  // app.module.ts turns TypeORM's blanket `synchronize` on when APP_ENV is
  // 'development'. Booting with that would rewrite the schema (including
  // destructive column rebuilds) before this script gets a say, so force it off
  // regardless of the environment file this runs against.
  process.env.APP_ENV = 'production';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const { upQueries } = await dataSource.driver.createSchemaBuilder().log();

    if (upQueries.length === 0) {
      console.log('✅ Database schema is already up to date.');
      return 0;
    }

    const additive = upQueries.filter((q) => ADDITIVE.test(q.query.trim()));
    const destructive = upQueries.filter((q) => !ADDITIVE.test(q.query.trim()));

    console.log(`Pending schema changes: ${upQueries.length}`);
    console.log(`  additive   : ${additive.length}`);
    console.log(`  needs review: ${destructive.length}`);

    if (destructive.length) {
      console.log('\n⚠️  Skipped (potentially destructive — review manually):');
      destructive.forEach((q) => console.log(`   ${q.query}`));
    }

    if (!additive.length) {
      console.log('\nNothing safe to apply automatically.');
      return destructive.length ? 2 : 0;
    }

    console.log('\nAdditive statements:');
    additive.forEach((q) => console.log(`   ${q.query}`));

    if (checkOnly) {
      console.log('\n--check: nothing was executed.');
      return 0;
    }

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      for (const q of additive) {
        await runner.query(q.query, q.parameters as any[] | undefined);
      }
      await runner.commitTransaction();
      console.log(`\n✅ Applied ${additive.length} statement(s).`);
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }

    return destructive.length ? 2 : 0;
  } finally {
    await app.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('❌ Schema sync failed:', err);
    process.exit(1);
  });
