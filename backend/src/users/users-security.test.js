require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UsersService } = require('./users.service');

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const c = '33333333-3333-4333-8333-333333333333';

const schoolAdmin = {
  id: 'actor-1',
  roles: [{ name: 'School Admin', hierarchy: 3 }],
  schools: [{ id: a }],
};
const globalAdmin = {
  id: 'actor-2',
  roles: [{ name: 'Admin', hierarchy: 1 }],
  schools: [],
};

function makeService({ actorById = {}, createdSchools = [] } = {}) {
  const usersRepo = {
    findOne: async ({ where }) => {
      if (where.email) return null;
      return actorById[where.id] || null;
    },
    create: (data) => ({ ...data }),
    save: async (entity) => entity,
    update: async () => {},
  };
  const calls = [];
  const qb = {
    calls,
    andWhere(cond, params) { calls.push({ cond, params }); return qb; },
    orderBy() { return qb; },
    getMany: async () => [],
  };
  const schoolsRepo = {
    find: async ({ where }) =>
      createdSchools.filter((s) => s.createdById === where.createdById).map(({ id }) => ({ id })),
    findBy: async (conditions) => {
      const ids = conditions.id?.value ?? conditions.id ?? [];
      return ids.map((id) => ({ id }));
    },
    createQueryBuilder: () => qb,
  };
  return { service: new UsersService(usersRepo, {}, schoolsRepo, {}), qb, usersRepo };
}

test('user creation cannot hand out schools outside the actor footprint', async () => {
  const { service } = makeService({
    actorById: { [schoolAdmin.id]: schoolAdmin },
    createdSchools: [{ id: c, createdById: schoolAdmin.id }],
  });

  // School Admin owns schools a + c; a request touching b must be refused.
  await assert.rejects(
    service.create(
      { firstName: 'X', lastName: 'Y', email: 'x@example.org', password: 'Password123!', schoolIds: [a, b] },
      schoolAdmin.id,
    ),
    /only assign schools/,
  );

  const saved = await service.create(
    { firstName: 'X', lastName: 'Y', email: 'x@example.org', password: 'Password123!', schoolIds: [a, c] },
    schoolAdmin.id,
  );
  assert.deepEqual(saved.schools.map((s) => s.id).sort(), [a, c]);
});

test('system callers (no actor) stay trusted for seeding', async () => {
  const { service } = makeService();
  const saved = await service.create({
    firstName: 'S', lastName: 'S', email: 's@example.org', password: 'Password123!', schoolIds: [a, b],
  });
  assert.equal(saved.schools.length, 2);
});

test('school registry picker is scoped to grantable schools for non-admin actors', async () => {
  const { service, qb } = makeService({
    actorById: { [schoolAdmin.id]: schoolAdmin },
    createdSchools: [{ id: c, createdById: schoolAdmin.id }],
  });

  await service.findAvailableSchools({ search: 'sch%' }, schoolAdmin.id);
  assert.ok(qb.calls.some((call) => call.cond.includes('school.id IN (:...grantableIds)')));
  assert.deepEqual(
    qb.calls.find((call) => call.cond.includes('grantableIds')).params.grantableIds.sort(),
    [a, c],
  );
  // LIKE metacharacters in the search term are escaped, not honoured.
  assert.ok(qb.calls.some((call) => call.params && call.params.search === '%sch\\%%'));

  const admin = makeService({ actorById: { [globalAdmin.id]: globalAdmin } });
  await admin.service.findAvailableSchools({}, globalAdmin.id);
  assert.ok(!admin.qb.calls.some((call) => call.cond.includes('grantableIds')));

  // Actor with no school footprint sees an empty picker instead of the registry.
  const empty = makeService({
    actorById: { 'actor-3': { id: 'actor-3', roles: [{ name: 'Custom', hierarchy: 3 }], schools: [] } },
  });
  const rows = await empty.service.findAvailableSchools({}, 'actor-3');
  assert.deepEqual(rows, []);
});

test('activity trail of more privileged users cannot be read by lower tiers', async () => {
  const superAdmin = { id: 'target', roles: [{ name: 'Super Admin', hierarchy: 0 }] };
  const teacher = { id: 'target2', roles: [{ name: 'Teacher', hierarchy: 4 }] };
  const usersRepo = {
    findOne: async ({ where }) => {
      if (where.id === 'actor') return globalAdmin;
      if (where.id === 'target') return superAdmin;
      if (where.id === 'target2') return teacher;
      return null;
    },
  };
  const qb = {
    where() { return qb; }, andWhere() { return qb; },
    orderBy() { return qb; }, take() { return qb; }, getMany: async () => [],
  };
  const service = new UsersService(usersRepo, {}, {}, {
    createQueryBuilder: () => qb,
  });

  await assert.rejects(service.getActivity('target', 'actor'), /more privileges/);
  assert.deepEqual(await service.getActivity('target2', 'actor'), []);
});
