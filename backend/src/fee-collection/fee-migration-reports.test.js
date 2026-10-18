require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FeeMigrationReportsController } = require('./fee-migration-reports.controller.ts');
const { GlobalAdminGuard } = require('../auth/guards/global-admin.guard.ts');
const { GUARDS_METADATA } = require('@nestjs/common/constants');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fee-reports-'));
  fs.writeFileSync(path.join(dir, 'fee-migration-preview-2026-10-18-03-21-48.csv'), 'a,b\n1,2\n');
  fs.writeFileSync(path.join(dir, 'secrets.csv'), 'nope');
  fs.writeFileSync(path.join(dir, 'fee-migration-preview-1.txt'), 'nope');
  process.env.FEE_REPORT_DIR = dir;
  return new FeeMigrationReportsController();
}

test('migration reports: only migration CSVs are listed', () => {
  const c = setup();
  assert.deepEqual(c.list().map((f) => f.name), ['fee-migration-preview-2026-10-18-03-21-48.csv']);
});

test('migration reports: downloads the file with attachment headers and refuses anything else', async () => {
  const c = setup();
  let headers;
  const res = { set: (h) => { headers = h; } };
  const file = c.download('fee-migration-preview-2026-10-18-03-21-48.csv', 'u1', res);
  assert.match(headers['Content-Disposition'], /^attachment;/);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.ok(file.getStream);
  file.getStream().destroy();
  for (const bad of ['secrets.csv', '../etc/passwd', '..%2f..%2fetc%2fpasswd', 'fee-migration-preview-9.csv', 'fee-migration-preview-1.txt']) {
    assert.throws(() => c.download(bad, 'u1', res), /File not found/, bad);
  }
});

test('migration reports: admin-tier guard is required', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, FeeMigrationReportsController) || [];
  assert.ok(guards.includes(GlobalAdminGuard));
});
