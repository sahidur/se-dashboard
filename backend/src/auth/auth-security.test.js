require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { AuthService } = require('./auth.service');

const hash = (password) => bcrypt.hash(password, 4);

function makeUsersService(overrides = {}) {
  const logs = [];
  const users = new Map();
  return {
    logs,
    users,
    service: {
      findOneByEmail: async (email) => users.get(email) || null,
      findOneById: async (id) => [...users.values()].find((u) => u.id === id) || null,
      logActivity: async (entry) => { logs.push(entry); },
      updateRefreshToken: async () => {},
      updateLastLogin: async () => {},
      updatePassword: async () => {},
      ...overrides,
    },
  };
}

test('failed logins and lockout are persisted to the audit trail without secrets', async () => {
  const { service, logs, users } = makeUsersService();
  users.set('known@example.org', {
    id: 'user-1', email: 'known@example.org', password: await hash('correct'), isActive: true,
  });
  const auth = new AuthService(service, {}, {});

  for (let i = 0; i < 5; i++) {
    await assert.rejects(auth.login({ email: 'known@example.org', password: 'supersecret' }), {
      message: 'Invalid credentials',
    });
  }

  const failed = logs.filter((l) => l.action === 'LOGIN_FAILED');
  const locked = logs.filter((l) => l.action === 'ACCOUNT_LOCKED');
  assert.equal(failed.length, 5);
  assert.ok(failed.every((l) => l.userId === 'user-1' && l.newData.reason === 'invalid_password'));
  assert.equal(locked.length, 1);
  assert.equal(locked[0].newData.reason, 'failed_login_threshold');
  assert.ok(!JSON.stringify(logs).includes('supersecret'));

  // 6th attempt is rejected by the lockout without another failure record.
  await assert.rejects(auth.login({ email: 'known@example.org', password: 'supersecret' }), {
    message: 'Invalid credentials',
  });
  assert.equal(logs.filter((l) => l.action === 'LOGIN_FAILED').length, 5);
});

test('unknown-account logins are audited uniformly and leak nothing', async () => {
  const { service, logs } = makeUsersService();
  const auth = new AuthService(service, {}, {});
  await assert.rejects(auth.login({ email: 'ghost@example.org', password: 'pw' }), {
    message: 'Invalid credentials',
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'LOGIN_FAILED');
  assert.equal(logs[0].newData.reason, 'unknown_account');
  assert.equal(logs[0].userId, undefined);
});

test('step-up password checks (passkey enrolment) share the brute-force lockout', async () => {
  const { service, logs, users } = makeUsersService();
  users.set('u@example.org', {
    id: 'user-2', email: 'u@example.org', password: await hash('correct'), isActive: true,
  });
  const auth = new AuthService(service, {}, {});

  for (let i = 0; i < 5; i++) {
    await assert.rejects(auth.verifyUserPassword('user-2', 'wrong'), {
      message: 'Password verification failed',
    });
  }
  assert.equal(logs.filter((l) => l.action === 'PASSWORD_VERIFY_FAILED').length, 5);
  assert.equal(logs.filter((l) => l.action === 'ACCOUNT_LOCKED').length, 1);

  // Locked: even the correct password is refused (no brute-force window).
  await assert.rejects(auth.verifyUserPassword('user-2', 'correct'), {
    message: 'Invalid credentials',
  });
  assert.ok(!JSON.stringify(logs).includes('wrong'));
});

test('change-password current-password failures are lockout-protected and audited', async () => {
  const { service, logs, users } = makeUsersService();
  users.set('u@example.org', {
    id: 'user-3', email: 'u@example.org', password: await hash('correct'), isActive: true,
  });
  const auth = new AuthService(service, {}, {});

  for (let i = 0; i < 5; i++) {
    await assert.rejects(auth.changePassword('user-3', 'wrong', 'BrandNew123!'), {
      message: 'Current password is incorrect',
    });
  }
  assert.equal(logs.filter((l) => l.action === 'PASSWORD_VERIFY_FAILED').length, 5);
  assert.equal(logs.filter((l) => l.action === 'ACCOUNT_LOCKED').length, 1);

  await assert.rejects(auth.changePassword('user-3', 'correct', 'BrandNew123!'), {
    message: 'Invalid credentials',
  });
});
