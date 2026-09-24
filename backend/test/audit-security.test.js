require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeAuditData } = require('../src/common/audit/sanitize-audit-data');
const { auditContextStorage, getAuditContext } = require('../src/common/audit/audit-context');
const { AuditService } = require('../src/common/audit/audit.service');

test('audit snapshots mask nested JSON credentials and preserve related entity IDs', () => {
  const input = {
    id: 'row-1',
    password: 'plain',
    settings: { accessToken: 'nested', apiKey: 'nested-key', safe: 'visible' },
    items: [{ config: { privateKey: 'key', nested: [{ otp: '123456' }] } }],
    relation: { id: 'user-1', email: 'hidden-by-relationship-snapshot' },
  };
  assert.deepEqual(sanitizeAuditData(input), {
    id: 'row-1',
    password: '***',
    settings: { accessToken: '***', apiKey: '***', safe: 'visible' },
    items: [{ config: { privateKey: '***', nested: [{ otp: '***' }] } }],
    relation: { id: 'user-1' },
  });
  assert.equal(input.settings.accessToken, 'nested');
});

test('audit IP uses Express trusted-proxy resolution, not raw forwarded headers', () => {
  auditContextStorage.run({ req: {
    ip: '198.51.100.2',
    headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.2' },
    socket: { remoteAddress: '127.0.0.1' },
    user: { id: 'actor-1' },
  } }, () => {
    assert.deepEqual(getAuditContext(), {
      userId: 'actor-1', ipAddress: '198.51.100.2', userAgent: undefined,
    });
  });
});

test('explicit audit writes sanitize credentials before persistence', async () => {
  let saved;
  const service = new AuditService({ insert: async (entry) => { saved = entry; } }, {});
  await service.record({
    module: 'Example', action: 'UPDATE',
    oldData: { payload: { clientSecret: 'old' } },
    newData: { payload: [{ refreshToken: 'new' }] },
  });
  assert.deepEqual(saved.oldData, { payload: { clientSecret: '***' } });
  assert.deepEqual(saved.newData, { payload: [{ refreshToken: '***' }] });
});
