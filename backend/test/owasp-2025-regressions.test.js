// Regression tests for the OWASP Top 10 (2025) audit fixes of 2026-10-16.
require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JwtService } = require('@nestjs/jwt');
const { ForbiddenException, ConflictException } = require('@nestjs/common');

const { hashRefreshToken, refreshTokenMatches } = require('../src/auth/refresh-token-hash');
const { AuthService } = require('../src/auth/auth.service');
const { AuthController } = require('../src/auth/auth.controller');
const { IS_PUBLIC_KEY } = require('../src/auth/decorators/public.decorator');
const { UsersService } = require('../src/users/users.service');
const { RolesService } = require('../src/roles/roles.service');
const { HtLeadershipGuard } = require('../src/data-collection/guards/ht-leadership.guard');
const { DataCollectionService } = require('../src/data-collection/data-collection.service');
const { SurveysService } = require('../src/surveys/surveys.service');

const ACCESS = 'a'.repeat(48);
const REFRESH = 'r'.repeat(48);
const USER_ID = '3f2b8c1e-1111-4a2b-9c3d-aaaaaaaaaaaa';
const config = { get: (k, d) => ({ JWT_SECRET: ACCESS, JWT_REFRESH_SECRET: REFRESH }[k] ?? d) };
const signRefresh = (claims, expiresIn = '7d') =>
  jwt.sign({ sub: USER_ID, typ: 'refresh', ...claims }, REFRESH, { algorithm: 'HS256', expiresIn });

// ── A04/A07: refresh-token digest ──────────────────────────────────────────

test('refresh-token digest distinguishes tokens that share a 72-byte prefix', () => {
  const t1 = signRefresh({ pwv: 1 });
  const t2 = signRefresh({ pwv: 999 }, '1d');
  assert.equal(t1.slice(0, 72), t2.slice(0, 72), 'precondition: same bcrypt-visible prefix');
  // The vulnerable behaviour this replaces:
  assert.equal(bcrypt.compareSync(t2, bcrypt.hashSync(t1, 4)), true);

  const stored = hashRefreshToken(t1);
  assert.equal(refreshTokenMatches(t1, stored), true);
  assert.equal(refreshTokenMatches(t2, stored), false);
  // Legacy bcrypt digests are never accepted.
  assert.equal(refreshTokenMatches(t1, bcrypt.hashSync(t1, 4)), false);
  assert.equal(refreshTokenMatches(t1, null), false);
  assert.equal(refreshTokenMatches('', stored), false);
});

function refreshFixture(user) {
  const users = {
    findOneById: async (id) => (id === user.id ? user : null),
    updateRefreshToken: async (_id, token) => {
      user.refreshToken = token ? hashRefreshToken(token) : null;
    },
    logActivity: async () => {},
  };
  return new AuthService(users, new JwtService({}), config);
}

test('refresh rejects other tokens of the same user (rotation is enforced)', async () => {
  const current = signRefresh({ pwv: 0 });
  const stolenOld = signRefresh({ pwv: 0 }, '6d');
  const user = { id: USER_ID, isActive: true, passwordChangedAt: null, refreshToken: hashRefreshToken(current) };
  const auth = refreshFixture(user);

  await assert.rejects(auth.refreshTokens(stolenOld), { message: 'Invalid refresh token' });
  const rotated = await auth.refreshTokens(current);
  assert.ok(rotated.accessToken && rotated.refreshToken);
  assert.equal(refreshTokenMatches(rotated.refreshToken, user.refreshToken), true);
});

test('refresh rejects tokens issued before a password change (pwv)', async () => {
  const changedAt = new Date('2026-10-01T00:00:00Z');
  const stale = signRefresh({ pwv: changedAt.getTime() - 1 });
  const user = { id: USER_ID, isActive: true, passwordChangedAt: changedAt, refreshToken: hashRefreshToken(stale) };
  const auth = refreshFixture(user);
  await assert.rejects(auth.refreshTokens(stale), { message: 'Invalid refresh token' });

  const missingPwv = signRefresh({});
  user.refreshToken = hashRefreshToken(missingPwv);
  await assert.rejects(auth.refreshTokens(missingPwv), { message: 'Invalid refresh token' });
});

test('grace-window use of a retired token does not re-arm the window', async () => {
  const t1 = signRefresh({ pwv: 0 }, '5d');
  const user = { id: USER_ID, isActive: true, passwordChangedAt: null, refreshToken: hashRefreshToken(t1) };
  const auth = refreshFixture(user);

  await auth.refreshTokens(t1); // rotates t1 away -> t1 enters the grace window
  const retired = auth.retiredRefreshTokens.get(USER_ID);
  const [[digest, firstSeen]] = [...retired.entries()];
  // Backdate so a re-arm would be observable.
  retired.set(digest, firstSeen - 30_000);

  await auth.refreshTokens(t1); // concurrent-tab duplicate, accepted via grace
  assert.equal(auth.retiredRefreshTokens.get(USER_ID).get(digest), firstSeen - 30_000);

  retired.set(digest, Date.now() - 61_000); // grace expired
  await assert.rejects(auth.refreshTokens(t1), { message: 'Invalid refresh token' });
});

// ── A07: logout revokes even with an expired access token ──────────────────

test('logout is public and revokes the session via the refresh cookie', async () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout), true);

  let presented;
  const controller = new AuthController({ logoutWithRefreshToken: async (t) => { presented = t; } }, {});
  const cleared = [];
  const res = { clearCookie: (name) => cleared.push(name), cookie: () => {} };
  const body = await controller.logout({ cookies: { se360_rt: 'rt-cookie' } }, res);
  assert.equal(presented, 'rt-cookie');
  assert.deepEqual(body, { message: 'Logged out successfully' });
  assert.ok(cleared.includes('se360_at') && cleared.includes('se360_rt'));
});

test('logoutWithRefreshToken clears the stored hash only for the matching token', async () => {
  const current = signRefresh({ pwv: 0 });
  const user = { id: USER_ID, isActive: true, passwordChangedAt: null, refreshToken: hashRefreshToken(current) };
  const auth = refreshFixture(user);

  await auth.logoutWithRefreshToken(jwt.sign({ sub: USER_ID }, 'x'.repeat(40))); // forged
  await auth.logoutWithRefreshToken(signRefresh({ pwv: 0 }, '2d')); // other token
  await auth.logoutWithRefreshToken(undefined);
  assert.ok(user.refreshToken, 'non-matching tokens must not log the user out');

  await auth.logoutWithRefreshToken(current);
  assert.equal(user.refreshToken, null);
});

// ── A01: privileged role names ─────────────────────────────────────────────

const adminRole = { id: 'role-admin', name: 'Admin', hierarchy: 1, permissions: [] };
const managerRole = {
  id: 'role-rm', name: 'Regional Manager', hierarchy: 1,
  permissions: [{ module: 'roles', action: 'update' }, { module: 'users', action: 'update' }],
};

test('non-Super-Admins cannot modify the Admin role (escalation path)', async () => {
  const actor = { id: 'actor', roles: [managerRole] };
  const roles = new RolesService(
    { findOne: async () => ({ ...adminRole }) },
    {},
    { findOneById: async () => actor },
    { record: async () => {} },
  );
  await assert.rejects(roles.update(adminRole.id, { permissions: [] }, actor.id), ForbiddenException);
  await assert.rejects(roles.remove(adminRole.id, actor.id), ForbiddenException);
});

function usersFixture(actor, target) {
  const saved = [];
  const usersRepo = {
    findOne: async ({ where }) => (where.id === actor.id ? actor : where.id === target.id ? target : null),
    save: async (e) => { saved.push(e); return e; },
    update: async (id, patch) => { if (id === target.id) Object.assign(target, patch); },
    softRemove: async (e) => { saved.push(e); return e; },
  };
  const rolesRepo = { find: async () => [adminRole] };
  return { service: new UsersService(usersRepo, rolesRepo, {}, {}), saved };
}

test('a same-level custom role cannot hand out the Admin role', async () => {
  const actor = { id: 'actor', roles: [managerRole] };
  const target = { id: 'actor', roles: [managerRole] }; // self-assignment attempt
  const { service } = usersFixture(actor, actor);
  await assert.rejects(service.assignRoles(target.id, [adminRole.id], actor.id), {
    message: 'Only an administrator can assign administrator roles',
  });
  await assert.rejects(service.update(target.id, { roleIds: [adminRole.id] }, actor.id), ForbiddenException);
});

test('admins can still assign the Admin role', async () => {
  const actor = { id: 'admin', roles: [{ ...adminRole, permissions: [{ module: 'users', action: 'update' }] }] };
  const target = { id: 'target', roles: [] };
  const { service } = usersFixture(actor, target);
  const saved = await service.assignRoles(target.id, [adminRole.id], actor.id);
  assert.deepEqual(saved.roles.map((r) => r.name), ['Admin']);
});

test('deactivating or deleting a user revokes the stored refresh token', async () => {
  const actor = { id: 'admin', roles: [{ name: 'Super Admin', hierarchy: 0, permissions: [] }] };
  const target = { id: 'target', roles: [], isActive: true, refreshToken: 'sha256:abc' };
  const { service } = usersFixture(actor, target);
  const deactivated = await service.setStatus(target.id, false, actor.id);
  assert.equal(deactivated.refreshToken, null);

  target.refreshToken = 'sha256:def';
  await service.remove(target.id, actor.id);
  assert.equal(target.refreshToken, null);
});

// ── A01: per-question HT leadership grant ──────────────────────────────────

function guardContext(body) {
  return { switchToHttp: () => ({ getRequest: () => ({ body, user: { id: 'u' } }) }) };
}

test('HT leadership: null and legacy boolean are stripped without the grant', async () => {
  const guard = new HtLeadershipGuard({
    findOneById: async () => ({ roles: [{ name: 'Teacher', permissions: [{ module: 'data-collection', action: 'create' }] }] }),
  });
  const body = { schoolId: 's', headTeacherLeadership: null, headTeacherLeadershipGood: false, other: 1 };
  assert.equal(await guard.canActivate(guardContext(body)), true);
  assert.deepEqual(body, { schoolId: 's', other: 1 });

  const body2 = { headTeacherLeadership: 'weak' };
  await guard.canActivate(guardContext(body2));
  assert.deepEqual(body2, {});
});

test('HT leadership: holders of the grant keep both fields', async () => {
  const guard = new HtLeadershipGuard({
    findOneById: async () => ({
      roles: [{ name: 'Lead', permissions: [{ module: 'data-collection', action: 'update', resource: 'ht-leadership' }] }],
    }),
  });
  const body = { headTeacherLeadership: null, headTeacherLeadershipGood: true };
  await guard.canActivate(guardContext(body));
  assert.deepEqual(body, { headTeacherLeadership: null, headTeacherLeadershipGood: true });
});

// ── A01/A08: school update mass assignment ─────────────────────────────────

function schoolService(school, { assigned = [school.id], others = [] } = {}) {
  const svc = Object.create(DataCollectionService.prototype);
  svc.usersService = { getSchools: async () => assigned.map((id) => ({ id })) };
  svc.schoolRepo = {
    findOne: async ({ where }) => {
      if (where.id) return where.id === school.id ? { ...school } : null;
      return [school, ...others].find((s) => s.code === where.code) || null;
    },
    save: async (e) => e,
  };
  return svc;
}

test('assigned (non-creator) users cannot change school code/category/status', async () => {
  const school = { id: 's1', code: 'SCH-1', schoolCategory: 'BA', isActive: true, createdById: 'creator', name: 'A' };
  const svc = schoolService(school);
  for (const patch of [{ code: 'SCH-X' }, { schoolCategory: 'BSS' }, { isActive: false }]) {
    await assert.rejects(svc.updateSchool('s1', patch, 'teacher', ['Teacher']), ForbiddenException);
  }
  // Unchanged protected values (full-form resubmission) and descriptive edits still work.
  const saved = await svc.updateSchool('s1', { code: 'SCH-1', isActive: true, name: 'B' }, 'teacher', ['Teacher']);
  assert.equal(saved.name, 'B');
});

test('school code changes keep codes unique', async () => {
  const school = { id: 's1', code: 'SCH-1', createdById: 'creator' };
  const svc = schoolService(school, { others: [{ id: 's2', code: 'SCH-2' }] });
  await assert.rejects(svc.updateSchool('s1', { code: 'SCH-2' }, 'creator', []), ConflictException);
  const saved = await svc.updateSchool('s1', { code: 'SCH-9' }, 'admin', ['Admin']);
  assert.equal(saved.code, 'SCH-9');
});

// ── A05: CSV export injection ──────────────────────────────────────────────

test('survey CSV cells are quoted so commas/newlines cannot smuggle formulas', () => {
  const cell = (v) => SurveysService.csvCell(v);
  assert.equal(cell('ok,=HYPERLINK("https://evil")'), '"ok,=HYPERLINK(""https://evil"")"');
  assert.equal(cell('=1+1'), `"'=1+1"`);
  assert.equal(cell('\n=cmd'), `"'\n=cmd"`);
  assert.equal(cell(null), '""');
  assert.equal(cell(42), '"42"');
});
