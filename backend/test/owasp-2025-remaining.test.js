// Regression tests for the second round of OWASP Top 10 (2025) fixes.
require('ts-node/register/transpile-only');
require('reflect-metadata');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JwtService } = require('@nestjs/jwt');
const { ForbiddenException, NotFoundException, BadRequestException } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { DataSource } = require('typeorm');

const { AuthService } = require('../src/auth/auth.service');
const { JwtStrategy } = require('../src/auth/strategies/jwt.strategy');
const { WebAuthnService } = require('../src/auth/webauthn.service');
const { hashRefreshToken } = require('../src/auth/refresh-token-hash');
const { UsersService } = require('../src/users/users.service');
const { User } = require('../src/users/entities/user.entity');
const { RolesService } = require('../src/roles/roles.service');
const { SurveysService } = require('../src/surveys/surveys.service');
const { DataCollectionService } = require('../src/data-collection/data-collection.service');
const { FilesService } = require('../src/files/files.service');
const { FilesController } = require('../src/files/files.controller');
const { GlobalAdminGuard } = require('../src/auth/guards/global-admin.guard');
const { isSafeAssetUrl } = require('../src/common/validators/is-safe-asset-url');
const { CreateUserDto } = require('../src/users/dto/create-user.dto');
const { FeeCollectionService } = require('../src/fee-collection/fee-collection.service');
const { Payment } = require('../src/fee-collection/entities/payment.entity');
const { Receipt } = require('../src/fee-collection/entities/receipt.entity');
const { SchoolScopeGuard } = require('../src/students/school-scope.guard');

const ACCESS = 'a'.repeat(48);
const REFRESH = 'r'.repeat(48);
const config = { get: (k, d) => ({ JWT_SECRET: ACCESS, JWT_REFRESH_SECRET: REFRESH }[k] ?? d) };
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';

// ── A07: token type separation ─────────────────────────────────────────────

test('refresh endpoint rejects tokens that are not typ=refresh', async () => {
  const user = { id: 'u1', isActive: true, passwordChangedAt: null };
  const auth = new AuthService(
    { findOneById: async () => user, updateRefreshToken: async () => {} },
    new JwtService({}),
    config,
  );
  const untyped = jwt.sign({ sub: 'u1', pwv: 0 }, REFRESH);
  user.refreshToken = hashRefreshToken(untyped);
  await assert.rejects(auth.refreshTokens(untyped), { message: 'Invalid refresh token' });

  const typed = jwt.sign({ sub: 'u1', pwv: 0, typ: 'refresh' }, REFRESH);
  user.refreshToken = hashRefreshToken(typed);
  const pair = await auth.refreshTokens(typed);
  assert.equal(jwt.decode(pair.accessToken).typ, 'access');
  assert.equal(jwt.decode(pair.refreshToken).typ, 'refresh');
});

test('JwtStrategy never accepts a refresh-typed token as an access token', async () => {
  const strategy = new JwtStrategy(config, {
    findActiveUserById: async () => ({ id: 'u1', email: 'e', passwordChangedAt: null, roles: [] }),
  });
  await assert.rejects(strategy.validate({ sub: 'u1', pwv: 0, typ: 'refresh' }), { message: 'Invalid token type' });
  assert.equal((await strategy.validate({ sub: 'u1', pwv: 0, typ: 'access' })).id, 'u1');
  assert.equal((await strategy.validate({ sub: 'u1', pwv: 0 })).id, 'u1'); // pre-typ access token
});

// ── A07: lockout race ──────────────────────────────────────────────────────

test('parallel login burst cannot exceed the failed-attempt budget', async () => {
  const logs = [];
  let compares = 0;
  const hashed = await bcrypt.hash('correct', 4);
  const auth = new AuthService(
    {
      findOneByEmail: async () => ({ id: 'u1', email: 'x@example.org', password: hashed, isActive: true }),
      logActivity: async (e) => { logs.push(e); },
    },
    {},
    {},
  );
  const realCompare = bcrypt.compare;
  bcrypt.compare = async (...args) => { compares++; return realCompare(...args); };
  try {
    const attempts = Array.from({ length: 20 }, () =>
      auth.login({ email: 'x@example.org', password: 'wrong-password' }).catch((e) => e),
    );
    const results = await Promise.all(attempts);
    assert.ok(results.every((r) => r.message === 'Invalid credentials'));
  } finally {
    bcrypt.compare = realCompare;
  }
  assert.equal(logs.filter((l) => l.action === 'LOGIN_FAILED').length, 5);
  assert.equal(logs.filter((l) => l.action === 'ACCOUNT_LOCKED').length, 1);
  // 5 real compares + dummy compares for the 15 locked-out attempts; never
  // more than 5 compares against the REAL hash.
  assert.ok(compares >= 5);
});

// ── A07: passkey enumeration + challenge store bound ───────────────────────

function webauthn(passkeysByUser = {}, users = {}) {
  const cfg = { get: (k, d) => ({ JWT_SECRET: ACCESS, WEBAUTHN_ORIGIN: 'http://localhost:3000' }[k] ?? d) };
  return new WebAuthnService(
    { find: async ({ where }) => passkeysByUser[where.userId] || [] },
    { findOneByEmail: async (email) => users[email] || null },
    {},
    cfg,
  );
}

test('passkey login options give stable, realistic decoys for unknown emails', async () => {
  const svc = webauthn();
  const a = await svc.generateAuthentication('ghost@example.org');
  const b = await svc.generateAuthentication('ghost@example.org');
  const ids = (r) => r.options.allowCredentials.map((c) => c.id);
  assert.deepEqual(ids(a), ids(b), 'decoys must not change between calls');
  assert.ok(a.options.allowCredentials.every((c) => Array.isArray(c.transports) && c.transports.length));
  const other = await svc.generateAuthentication('someone-else@example.org');
  assert.notDeepEqual(ids(other), ids(a));
});

test('public challenge store is bounded', async () => {
  const svc = webauthn();
  for (let i = 0; i < WebAuthnService.MAX_CHALLENGES + 50; i++) svc.setChallenge(`auth:${i}`, 'c');
  assert.ok(svc.challenges.size <= WebAuthnService.MAX_CHALLENGES);
  assert.ok(svc.challenges.has(`auth:${WebAuthnService.MAX_CHALLENGES + 49}`));
});

// ── A01: user management tenant scope ──────────────────────────────────────

const roles = {
  admin: { id: 'r-admin', name: 'Admin', hierarchy: 1, permissions: [] },
  schoolAdmin: { id: 'r-sa', name: 'School Admin', hierarchy: 3, permissions: [] },
  teacher: { id: 'r-t', name: 'Teacher', hierarchy: 4, permissions: [] },
};

function usersSvc(people, createdSchools = []) {
  const updates = [];
  const repo = {
    findOne: async ({ where }) => people[where.id] || null,
    update: async (id, patch) => updates.push({ id, patch }),
    save: async (e) => e,
  };
  const schools = {
    find: async ({ where }) => createdSchools.filter((s) => s.createdById === where.createdById),
  };
  return { svc: new UsersService(repo, {}, schools, { create: (x) => x, save: async () => {} }), updates };
}

test('password reset: no same-level takeover, no self-reset, lower tiers ok', async () => {
  const people = {
    a1: { id: 'a1', roles: [roles.admin], schools: [] },
    a2: { id: 'a2', roles: [roles.admin], schools: [] },
    sa: { id: 'sa', roles: [roles.schoolAdmin], schools: [{ id: S1 }] },
  };
  const { svc } = usersSvc(people);
  svc.logActivity = async () => {};
  await assert.rejects(svc.resetPassword('a2', 'a1'), { message: /fewer privileges/ });
  await assert.rejects(svc.resetPassword('a1', 'a1'), { message: /Change password/ });
  const { newPassword } = await svc.resetPassword('sa', 'a1');
  assert.equal(typeof newPassword, 'string');
});

test('school-level managers cannot manage users of other schools', async () => {
  const people = {
    sa: { id: 'sa', roles: [roles.schoolAdmin], schools: [{ id: S1 }] },
    t1: { id: 't1', roles: [roles.teacher], schools: [{ id: S1 }] },
    t2: { id: 't2', roles: [roles.teacher], schools: [{ id: S2 }] },
    tBoth: { id: 'tBoth', roles: [roles.teacher], schools: [{ id: S1 }, { id: S2 }] },
  };
  const { svc } = usersSvc(people);
  svc.logActivity = async () => {};
  await assert.rejects(svc.resetPassword('t2', 'sa'), { message: /within your own schools/ });
  await assert.rejects(svc.resetPassword('tBoth', 'sa'), { message: /within your own schools/ });
  await assert.rejects(svc.setStatus('t2', false, 'sa'), ForbiddenException);
  await assert.rejects(svc.removeSchool('tBoth', S2, 'sa'), ForbiddenException);
  const ok = await svc.resetPassword('t1', 'sa');
  assert.ok(ok.newPassword);
});

test('user detail hides other tenants and narrows shared footprints', async () => {
  const people = {
    sa: { id: 'sa', roles: [roles.schoolAdmin], schools: [{ id: S1 }] },
    t2: { id: 't2', roles: [roles.teacher], schools: [{ id: S2 }] },
    tBoth: { id: 'tBoth', roles: [roles.teacher], schools: [{ id: S1 }, { id: S2 }] },
  };
  const { svc } = usersSvc(people);
  svc.findOneById = async (id) => (people[id] ? { ...people[id], schools: [...people[id].schools] } : null);
  assert.equal(await svc.findOneForViewer('t2', 'sa'), null);
  const both = await svc.findOneForViewer('tBoth', 'sa');
  assert.deepEqual(both.schools.map((s) => s.id), [S1]);
});

test('user list for non-admins is restricted to their tenant (SQL)', async () => {
  const ds = new DataSource({
    type: 'postgres',
    schema: 'bep',
    entities: [path.join(__dirname, '../src/**/*.entity.ts')],
  });
  await ds.buildMetadatas();
  const realRepo = ds.getRepository(User);
  let captured;
  const people = { sa: { id: 'sa', roles: [roles.schoolAdmin], schools: [{ id: S1 }] } };
  const repo = {
    findOne: async ({ where }) => people[where.id] || null,
    createQueryBuilder: (alias) => {
      const qb = realRepo.createQueryBuilder(alias);
      qb.getManyAndCount = async () => { captured = qb.getQueryAndParameters(); return [[], 0]; };
      return qb;
    },
  };
  const svc = new UsersService(repo, {}, { find: async () => [] }, {});
  await svc.findAll(1, 20, 'bob', undefined, undefined, undefined, 'sa');
  const [sql, params] = captured;
  assert.match(sql, /"user_schools"/);
  assert.match(sql, /NOT IN/);
  assert.ok(params.includes('sa'));
  assert.ok(params.includes(S1));
  assert.ok(params.includes(3)); // strictly-below hierarchy bound

  people.ad = { id: 'ad', roles: [roles.admin], schools: [] };
  await svc.findAll(1, 20, undefined, undefined, undefined, undefined, 'ad');
  assert.doesNotMatch(captured[0], /"user_schools"/);
});

// ── A01: survey school records and responses ───────────────────────────────

function surveys({ user, tenant, survey }) {
  const svc = Object.create(SurveysService.prototype);
  svc.usersService = {
    findOneById: async () => user,
    findTenantUserIds: async () => tenant,
  };
  svc.surveysRepository = { findOne: async () => survey };
  const calls = [];
  svc.schoolRecordRepository = {
    find: async (opts) => { calls.push(opts); return []; },
    findOne: async () => ({ id: 'rec', createdById: 'other-tenant-user' }),
  };
  svc.responsesRepository = { find: async () => [] };
  return { svc, calls };
}

test('school records are tenant-scoped for non-admin readers', async () => {
  const teacher = { id: 't', roles: [{ name: 'Teacher', permissions: [{ module: 'school-records', action: 'read' }] }] };
  const { svc, calls } = surveys({ user: teacher, tenant: new Set(['t', 'colleague']) });
  await svc.getAllSchoolRecords('t');
  assert.deepEqual([...calls[0].where.createdById._value].sort(), ['colleague', 't']);
  await assert.rejects(svc.getSchoolRecord('rec', 't'), NotFoundException);
  await assert.rejects(svc.getSchoolRecordResponses('rec', 't'), NotFoundException);

  const admin = surveys({
    user: { id: 'a', roles: [{ name: 'Admin', permissions: [{ module: 'school-records', action: 'read' }] }] },
    tenant: null,
  });
  await admin.svc.getAllSchoolRecords('a');
  assert.equal(admin.calls[0].where.createdById, undefined);
  await admin.svc.getSchoolRecord('rec', 'a');
});

test('surveys:update alone does not unlock other creators\' respondent data', async () => {
  const peer = { id: 'peer', roles: [{ name: 'Survey Creator', permissions: [{ module: 'surveys', action: 'update' }] }] };
  const { svc } = surveys({ user: peer, survey: { id: 's', createdById: 'owner' } });
  await assert.rejects(svc.assertResponseManagementAccess('s', 'peer'), ForbiddenException);
  await assert.rejects(
    svc.assertResponseReadAccess({ respondentId: 'x', surveyId: 's', survey: { createdById: 'owner' } }, 'peer'),
    NotFoundException,
  );
  // Own survey still fine; cross-survey listing is narrowed, not denied.
  assert.equal(await svc.assertResponseManagementAccess(null, 'peer'), false);
  const own = surveys({ user: peer, survey: { id: 's', createdById: 'peer' } });
  assert.equal(await own.svc.assertResponseManagementAccess('s', 'peer'), false);
});

// ── A01: form-scoped data-collection grants ────────────────────────────────

test('dashboard/profile only return contents of forms the caller may read', async () => {
  const svc = Object.create(DataCollectionService.prototype);
  svc.usersService = {
    findOneById: async () => ({
      roles: [{ name: 'Alumni Officer', permissions: [{ module: 'data-collection', action: 'read', resource: 'alumni' }] }],
    }),
  };
  const canRead = await svc.readableFormsPredicate('u', ['Alumni Officer']);
  assert.equal(canRead('alumni'), true);
  assert.equal(canRead('teachers-individual'), false);
  assert.equal(canRead('revenue'), false);

  const umbrella = Object.create(DataCollectionService.prototype);
  umbrella.usersService = {
    findOneById: async () => ({ roles: [{ name: 'X', permissions: [{ module: 'school-information', action: 'read' }] }] }),
  };
  assert.equal((await umbrella.readableFormsPredicate('u', ['X'], ['school-information']))('revenue'), true);
  assert.equal((await umbrella.readableFormsPredicate('u', ['X']))('revenue'), false);
  assert.equal((await svc.readableFormsPredicate('u', ['Admin']))('revenue'), true);
});

test('deleting a submitted form record requires "Edit Submitted Data"', async () => {
  const svc = Object.create(DataCollectionService.prototype);
  let removed = false;
  svc.validateSchoolAccess = async () => ({});
  svc.canEditSubmittedData = async () => false;
  svc.infraRepo = { findOne: async () => ({ id: 'i', schoolId: S1 }), softRemove: async () => { removed = true; } };
  await assert.rejects(svc.deleteInfrastructure('i', 'u', []), ForbiddenException);
  assert.equal(removed, false);
  svc.canEditSubmittedData = async () => true;
  await svc.deleteInfrastructure('i', 'u', []);
  assert.equal(removed, true);
});

// ── A01: exclusive grants cannot be minted from wildcards ──────────────────

test('wildcard data-collection grants cannot mint ht-leadership', async () => {
  const actor = {
    id: 'actor',
    roles: [{ id: 'r-own', name: 'Manager', hierarchy: 2, permissions: [
      { module: 'data-collection', action: 'create' }, { module: 'roles', action: 'create' },
    ] }],
  };
  const existingRole = {
    id: 'r-target', name: 'Lead', hierarchy: 3,
    permissions: [{ module: 'data-collection', action: 'create', resource: 'ht-leadership' }],
  };
  const saved = [];
  const roles = new RolesService(
    { findOne: async ({ where }) => (where.id ? { ...existingRole } : null), create: (x) => x, save: async (x) => ({ id: 'new', ...x }) },
    { create: (x) => x, save: async (x) => { saved.push(x); return x; }, delete: async () => {} },
    { findOneById: async () => actor },
    { record: async () => {} },
  );
  const leader = [{ module: 'data-collection', action: 'create', resource: 'ht-leadership' }];
  await assert.rejects(roles.create({ name: 'Mint', hierarchy: 3, permissions: leader }, 'actor'), ForbiddenException);
  // Editing a role that ALREADY carries the grant (e.g. its description) still works.
  await roles.update('r-target', { description: 'd', permissions: leader }, 'actor');
});

// ── A01/A05: files ─────────────────────────────────────────────────────────

test('private objects are readable by folder feature, uploader or admin only', () => {
  const user = (perms, id = 'u', name = 'Teacher') => ({ id, roles: [{ name, permissions: perms.map((m) => ({ module: m })) }] });
  const can = FilesService.canReadObject;
  assert.equal(FilesService.folderOfKey('bep-se/school-monitoring/x.png', 'bep-se'), 'school-monitoring');
  assert.equal(can('school-monitoring', undefined, user(['surveys'])), false);
  assert.equal(can('school-monitoring', undefined, user(['school-monitoring'])), true);
  assert.equal(can('school-monitoring', 'u', user([])), true); // uploader
  assert.equal(can('profile-pictures', undefined, user([])), true);
  assert.equal(can('made-up-folder', undefined, user(['surveys'])), false);
  assert.equal(can('made-up-folder', undefined, user([], 'a', 'Admin')), true);
});

test('file deletion is admin-tier only', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, FilesController.prototype.deleteFile) || [];
  assert.ok(guards.includes(GlobalAdminGuard));
});

test('stored asset URLs reject script-capable schemes', () => {
  for (const ok of ['', null, '/api/files/object?key=a%2Fb.png', 'https://x.digitaloceanspaces.com/a.png']) {
    assert.equal(isSafeAssetUrl(ok), true, String(ok));
  }
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.example/x', ' javascript:x', 'vbscript:x', '/\\evil']) {
    assert.equal(isSafeAssetUrl(bad), false, bad);
  }
  const errors = validateSync(plainToInstance(CreateUserDto, {
    firstName: 'A', lastName: 'B', email: 'a@b.org', password: 'Password123', profilePicture: 'javascript:alert(1)',
  }));
  assert.ok(errors.some((e) => e.property === 'profilePicture'));
});

// ── A08/A10: payments + error handling ─────────────────────────────────────

test('collecting a payment twice with the same idempotency key replays the first', async () => {
  const fee = { id: 'fee', status: 'due', payableAmount: '1000.00', paidAmount: '500.00', breakdown: [] };
  const previous = { id: 'p1', studentFeeId: 'fee', collectedById: 'u', amount: '500.00' };
  let saves = 0;
  const qb = { setLock() { return qb; }, where() { return qb; }, getOne: async () => fee };
  const manager = {
    createQueryBuilder: () => qb,
    findOne: async (entity) => (entity === Payment ? previous : entity === Receipt ? { id: 'rc1' } : null),
    save: async () => { saves++; },
  };
  const svc = Object.create(FeeCollectionService.prototype);
  svc.dataSource = { transaction: async (cb) => cb(manager) };
  const key = '33333333-3333-4333-8333-333333333333';
  const res = await svc.collectPayment({ studentFeeId: 'fee', amount: 500, paymentMethod: 'cash', idempotencyKey: key }, 'u');
  assert.equal(res.payment, previous);
  assert.equal(res.receipt.id, 'rc1');
  assert.equal(saves, 0);
  await assert.rejects(
    svc.collectPayment({ studentFeeId: 'fee', amount: 300, paymentMethod: 'cash', idempotencyKey: key }, 'u'),
    BadRequestException,
  );
});

test('fee generation never returns raw database error text', async () => {
  const students = [{ id: 's1', admissionNumber: 'A-1', classId: null }];
  let finds = 0;
  const manager = {
    find: async () => (++finds === 1 ? students : []),
    create: (_e, v) => v,
    query: async () => {},
    save: async () => { throw new Error('insert or update on table "edu_student_fees" violates foreign key constraint "FK_x"'); },
  };
  const svc = Object.create(FeeCollectionService.prototype);
  svc.logger = { error: () => {}, warn: () => {} };
  svc.dataSource = { transaction: async (cb) => cb(manager) };
  const res = await svc.generateFees({ schoolId: S1, academicYearId: 'y', month: 1 });
  assert.equal(res.failed[0].reason, 'Could not generate fee');
  assert.ok(!JSON.stringify(res).includes('edu_student_fees'));
});

function scopeContext({ params = {}, body = {}, query = {}, method = 'GET', routePath, controller }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params, body, query, method, route: { path: routePath }, user: { id: 'u', roles: ['Accounts'] } }) }),
    getClass: () => ({ name: controller }),
  };
}

test('school scope guard: malformed ids are 400s and payment lists need a school', async () => {
  const guard = new SchoolScopeGuard({ getRepository: () => ({ findOne: async () => null }) }, {});
  await assert.rejects(
    guard.canActivate(scopeContext({ body: { studentFeeId: "x' OR 1=1" }, method: 'POST', routePath: '/api/fee-collection/payments', controller: 'FeeCollectionController' })),
    BadRequestException,
  );
  await assert.rejects(
    guard.canActivate(scopeContext({ query: { schoolId: [S1, S2] }, routePath: '/api/students', controller: 'StudentsController' })),
    BadRequestException,
  );
  const studentRepo = { findOne: async () => ({ id: 'st', schoolId: S1 }) };
  const g2 = new SchoolScopeGuard({ getRepository: () => studentRepo }, {});
  await assert.rejects(
    g2.canActivate(scopeContext({ query: { studentId: S2 }, routePath: '/api/fee-collection/payments', controller: 'FeeCollectionController' })),
    NotFoundException,
  );
});

// ── A02/A07: bootstrap configuration ───────────────────────────────────────

test('API refuses to boot when access and refresh secrets are identical', () => {
  const same = 'z'.repeat(64);
  const r = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/main.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, JWT_SECRET: same, JWT_REFRESH_SECRET: same, DB_PASSWORD: '' },
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /must be different values/);
});

test('no urlencoded body parser is registered (login CSRF via HTML forms)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
  assert.doesNotMatch(src, /useBodyParser\(\s*['"]urlencoded/);
  assert.match(src, /bodyParser:\s*false/);
});

// ── Round 3 audit regression tests ─────────────────────────────────────────

test('WebP magic-byte check requires BOTH RIFF at 0 and WEBP at 8; CSV rejects NUL bytes', () => {
  const svc = Object.create(FilesService.prototype);
  // Only RIFF (e.g. WAV audio) must be rejected as image/webp
  assert.throws(
    () => svc.assertMagicBytes({ mimetype: 'image/webp', buffer: Buffer.from('RIFF1234WAVEfmt ') }),
    BadRequestException,
  );
  // Only WEBP at offset 8 (e.g. HTML payload `<html>\n\nWEBP...`) must be rejected
  assert.throws(
    () => svc.assertMagicBytes({ mimetype: 'image/webp', buffer: Buffer.from('<html>\n\nWEBP<script>') }),
    BadRequestException,
  );
  // Valid WebP container passes
  assert.doesNotThrow(() =>
    svc.assertMagicBytes({ mimetype: 'image/webp', buffer: Buffer.from('RIFF\x00\x00\x00\x00WEBPvp8 ') }),
  );
  // Binary payload disguised as text/csv is rejected
  assert.throws(
    () => svc.assertMagicBytes({ mimetype: 'text/csv', buffer: Buffer.from('a,b\x00c,d') }),
    BadRequestException,
  );
  assert.doesNotThrow(() =>
    svc.assertMagicBytes({ mimetype: 'text/csv', buffer: Buffer.from('name,roll\nAlice,1\n') }),
  );
});

test('deleteSchool blocks assigned (non-creator, non-admin) users', async () => {
  const svc = Object.create(DataCollectionService.prototype);
  let deleted = false;
  svc.validateSchoolAccess = async () => ({ id: S1, createdById: 'creator' });
  svc.schoolRepo = { softRemove: async () => { deleted = true; } };

  await assert.rejects(svc.deleteSchool(S1, 'assigned-user', ['School Admin']), ForbiddenException);
  assert.equal(deleted, false);

  await svc.deleteSchool(S1, 'creator', ['School Admin']);
  assert.equal(deleted, true);
});

test('recalculateStudentInManager scopes unpaid fee recalculation to the student current school', async () => {
  const svc = Object.create(FeeCollectionService.prototype);
  let feeWhere;
  const manager = {
    findOne: async () => ({ id: 'student-1', schoolId: S2 }),
    find: async (_entity, opts) => {
      feeWhere = opts.where;
      return [];
    },
  };
  await svc.recalculateStudentInManager(manager, 'student-1', 'year-1');
  assert.equal(feeWhere.schoolId, S2);
});

test('refresh tokens include a unique jti so same-second rotations never collide', async () => {
  const user = { id: 'u1', isActive: true, passwordChangedAt: null };
  const auth = new AuthService(
    { findOneById: async () => user, updateRefreshToken: async (_id, rt) => { user.refreshToken = hashRefreshToken(rt); } },
    new JwtService({}),
    config,
  );
  const initial = jwt.sign({ sub: 'u1', pwv: 0, typ: 'refresh', jti: 'init' }, REFRESH);
  user.refreshToken = hashRefreshToken(initial);
  const first = await auth.refreshTokens(initial);
  const second = await auth.refreshTokens(first.refreshToken);
  assert.notEqual(first.refreshToken, second.refreshToken);
  assert.ok(jwt.decode(first.refreshToken).jti);
  assert.notEqual(jwt.decode(first.refreshToken).jti, jwt.decode(second.refreshToken).jti);
});

test('passkey step-up DTOs bound password length and audit query DTO validates UUID and dates', () => {
  const { VerifyRegistrationDto, DeletePasskeyDto } = require('../src/auth/dto/passkey.dto');
  const { QueryAuditLogDto } = require('../src/common/audit/dto/query-audit-log.dto');

  const overlong = 'p'.repeat(129);
  assert.ok(
    validateSync(plainToInstance(VerifyRegistrationDto, { response: {}, password: overlong })).some(
      (e) => e.property === 'password',
    ),
  );
  assert.ok(
    validateSync(plainToInstance(DeletePasskeyDto, { password: overlong })).some(
      (e) => e.property === 'password',
    ),
  );
  const badAuditQuery = plainToInstance(QueryAuditLogDto, {
    userId: 'not-a-uuid',
    startDate: 'not-a-date',
  });
  const props = validateSync(badAuditQuery).map((e) => e.property);
  assert.ok(props.includes('userId'));
  assert.ok(props.includes('startDate'));
});

test('surveys: findAssignedSurveys handles empty roles & exclusions, and submitResponse enforces date windows', async () => {
  const svc = Object.create(SurveysService.prototype);
  let capturedParams;
  const qb = {
    leftJoinAndSelect() { return qb; },
    where() { return qb; },
    andWhere(_cond, params) {
      if (params && params.roleIds) capturedParams = params;
      return qb;
    },
    orderBy() { return qb; },
    addOrderBy() { return qb; },
    getMany: async () => [
      {
        id: 's-excluded',
        assignments: [{ roleId: 'r1', excludeUserIds: ['u1'] }],
      },
      {
        id: 's-included',
        assignments: [{ schoolId: S1, excludeUserIds: [] }],
      },
    ],
  };
  svc.surveysRepository = {
    createQueryBuilder: () => qb,
    findOne: async () => ({
      id: 's1',
      status: 'published',
      startDate: new Date(Date.now() + 86400000),
    }),
  };
  const assigned = await svc.findAssignedSurveys('u1', [], [S1]);
  assert.notEqual(capturedParams.roleIds[0], 'none');
  assert.deepEqual(assigned.map((s) => s.id), ['s-included']);
  assert.equal(assigned[0].assignments, undefined);

  await assert.rejects(
    svc.submitResponse({ surveyId: 's1', answers: [] }, 'u1'),
    /not started yet/,
  );
});
