/**
 * One-off data migration: normalizes grade / item / award-level vocabularies
 * across the data-collection tables to the canonical spellings used by the
 * forms and DTOs, so previously submitted rows match form filters again.
 *
 * Canonical targets:
 *  - dc_students_info.grade             -> slug   : play_learn | nursery | g1..g12
 *  - dc_fee_structure.grade (+ _log)    -> label  : Play & Learn | Nursery | Grade N
 *  - dc_cocurricular.grade              -> label
 *  - dc_students_performance.grade      -> short  : Play & Learn | Nursery | GN
 *  - dc_activity_participation.grade    -> short  ; item slugs -> DTO labels
 *  - dc_event_participation.award_level -> School | Upazila | Zila | Divisional | National
 *
 * Idempotent: already-canonical values are untouched. Rows that would collide
 * with an existing canonical-format twin (same unique key) are removed first,
 * preferring the canonical spelling.
 *
 * Usage: node scripts/migrate-grade-values.js   (from backend/)
 */
const fs = require('fs');

// Parse .env manually (dotenv is not a project dependency).
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true'
      ? { ca: fs.readFileSync(process.env.DB_CA_CERT || 'ca-certificate.crt', 'utf8') }
      : false,
  });
  await c.connect();
  const run = async (label, sql) => {
    const r = await c.query(sql);
    console.log(`${label}: ${r.rowCount}`);
  };
  try {
    await c.query('BEGIN');
    // ── Collapse potential unique-key collisions between legacy ("1") and
    //    already-canonical ("g1"/"Grade 1"/"G1") rows sharing every other key column.
    await run('collapse students_info',
      `DELETE FROM bep.dc_students_info a USING bep.dc_students_info b
       WHERE a.grade ~ '^[0-9]{1,2}$' AND b.grade = 'g' || (a.grade)::int
         AND a.school_id = b.school_id AND a.academic_year = b.academic_year AND a.month = b.month`);
    await run('collapse fee_structure',
      `DELETE FROM bep.dc_fee_structure a USING bep.dc_fee_structure b
       WHERE a.grade ~ '^[0-9]{1,2}$' AND b.grade = 'Grade ' || (a.grade)::int
         AND a.school_id = b.school_id AND a.academic_year = b.academic_year AND a.month = b.month`);
    await run('collapse cocurricular',
      `DELETE FROM bep.dc_cocurricular a USING bep.dc_cocurricular b
       WHERE a.grade ~ '^[0-9]{1,2}$' AND b.grade = 'Grade ' || (a.grade)::int
         AND a.school_id = b.school_id AND a.academic_year = b.academic_year AND a.month = b.month`);
    await run('collapse students_performance',
      `DELETE FROM bep.dc_students_performance a USING bep.dc_students_performance b
       WHERE a.grade ~ '^[0-9]{1,2}$' AND b.grade = 'G' || (a.grade)::int
         AND a.school_id = b.school_id AND a.academic_year = b.academic_year AND a.exam_name = b.exam_name`);

    // ── Normalize grades ──
    await run('students_info grade', `UPDATE bep.dc_students_info SET grade = 'g' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);
    await run('fee_structure grade', `UPDATE bep.dc_fee_structure SET grade = 'Grade ' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);
    await run('fee_structure_log grade', `UPDATE bep.dc_fee_structure_log SET grade = 'Grade ' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);
    await run('cocurricular grade', `UPDATE bep.dc_cocurricular SET grade = 'Grade ' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);
    await run('students_performance grade', `UPDATE bep.dc_students_performance SET grade = 'G' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);
    await run('activity_participation grade', `UPDATE bep.dc_activity_participation SET grade = 'G' || grade::int WHERE grade ~ '^[0-9]{1,2}$'`);

    // ── Activity items: drop legacy rows that would collide with canonical ones,
    //    then rename the rest ──
    await run('activity collapse item-dupes',
      `DELETE FROM bep.dc_activity_participation a USING bep.dc_activity_participation b
       WHERE lower(btrim(a.item)) IN ('corner','club','library','lab')
         AND b.item = CASE lower(btrim(a.item))
             WHEN 'corner' THEN 'Corner activity'
             WHEN 'club' THEN 'Language & Literacy club'
             WHEN 'library' THEN 'Use of library'
             ELSE 'Science lab' END
         AND a.school_id = b.school_id AND a.year = b.year AND a.month = b.month AND a.grade = b.grade`);
    await run('activity item', `UPDATE bep.dc_activity_participation SET item = CASE lower(btrim(item))
        WHEN 'corner' THEN 'Corner activity'
        WHEN 'club' THEN 'Language & Literacy club'
        WHEN 'library' THEN 'Use of library'
        WHEN 'lab' THEN 'Science lab' ELSE item END
      WHERE lower(btrim(item)) IN ('corner','club','library','lab')`);

    // ── Event award levels ──
    await run('event award_level', `UPDATE bep.dc_event_participation SET award_level = CASE lower(btrim(award_level))
        WHEN 'school' THEN 'School' WHEN 'upazila' THEN 'Upazila' WHEN 'district' THEN 'Zila'
        WHEN 'zila' THEN 'Zila' WHEN 'division' THEN 'Divisional' WHEN 'national' THEN 'National'
        ELSE award_level END
      WHERE award_level !~ '^(School|Upazila|Zila|Divisional|National)$'`);

    await c.query('COMMIT');
    console.log('COMMITTED');
  } catch (err) {
    try { await c.query('ROLLBACK'); } catch { /* already closed */ }
    console.error('FAILED', err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
