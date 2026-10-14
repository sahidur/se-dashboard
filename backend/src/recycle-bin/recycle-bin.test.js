require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RecycleBinService } = require('./recycle-bin.service.ts');
const { User } = require('../users/entities/user.entity.ts');

const actorId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

/** Fake entity metadata: a many-to-one relation to User (or none). */
function fakeMeta(tablePath, relToUser, nullable) {
  return {
    tablePath,
    relations: relToUser
      ? [{
          relationType: 'many-to-one',
          inverseEntityMetadata: { target: User },
          joinColumns: [{ databaseName: 'user_id', isNullable: nullable }],
        }]
      : [],
  };
}

function buildService({ metas, removeImpl, findOneImpl }) {
  const queries = [];
  const removed = [];
  const manager = {
    query: async (sql, params) => {
      queries.push({ sql, params });
    },
    remove: async (_target, entity) => {
      if (removeImpl) return removeImpl(entity);
      removed.push(entity);
      return entity;
    },
  };
  const service = Object.create(RecycleBinService.prototype);
  service.usersRepo = {
    target: User,
    findOne: findOneImpl,
  };
  service.dataSource = {
    entityMetadatas: metas,
    transaction: async (cb) => cb(manager),
  };
  return { service, queries, removed };
}

/** The recycle-bin item is loaded first, then actor/target for the guard. */
function stubFindOne() {
  let calls = 0;
  return async () => {
    calls++;
    if (calls === 1) return { id: userId, deletedAt: new Date() };
    return { roles: [{ name: 'Super Admin' }] };
  };
}

test('permanent delete of a user clears nullable user references, then hard-deletes', async () => {
  const { service, queries, removed } = buildService({
    metas: [
      fakeMeta('audit_logs', true, true),
      fakeMeta('payments', true, false),
      fakeMeta('roles', false, false),
    ],
    findOneImpl: stubFindOne(),
  });

  const result = await service.permanentDelete('user', userId, actorId, ['Teacher']);

  assert.equal(result.message, 'user permanently deleted');
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /UPDATE audit_logs SET user_id = NULL WHERE user_id = \$1/);
  assert.deepEqual(queries[0].params, [userId]);
  assert.equal(removed.length, 1);
});

test('permanent delete of a user blocked by NOT NULL references returns a conflict, not a 500', async () => {
  const fkError = new Error('update or delete on table "users" violates foreign key constraint');
  fkError.driverError = { code: '23503' };
  const { service } = buildService({
    metas: [fakeMeta('audit_logs', true, true)],
    removeImpl: async () => {
      throw fkError;
    },
    findOneImpl: stubFindOne(),
  });

  await assert.rejects(
    service.permanentDelete('user', userId, actorId, ['Teacher']),
    /cannot be permanently deleted/,
  );
});

test('permanent delete of any type maps foreign-key violations to a conflict', async () => {
  const fkError = new Error('violates foreign key constraint');
  fkError.driverError = { code: '23503' };
  const service = Object.create(RecycleBinService.prototype);
  service.surveysRepo = {
    target: function Survey() {},
    findOne: async () => ({ id: 'survey-1', deletedAt: new Date() }),
  };
  service.dataSource = {
    transaction: async (cb) =>
      cb({
        query: async () => {},
        remove: async () => {
          throw fkError;
        },
      }),
  };

  await assert.rejects(
    // Admin-tier roles pass the new tenant/ownership guard, so the request
    // still reaches the FK-violation → Conflict mapping this test targets.
    service.permanentDelete('survey', 'survey-1', actorId, ['Super Admin']),
    /still referenced by other records/,
  );
});

test('restore/permanent delete of another tenant item is denied with a 404', async () => {
  const service = Object.create(RecycleBinService.prototype);
  service.surveysRepo = {
    findOne: async () => ({ id: 'survey-1', deletedAt: new Date(), createdById: 'someone-else' }),
  };
  // Non-admin actor with no school access helpers needed for surveys.
  await assert.rejects(
    service.restore('survey', 'survey-1', actorId, ['Teacher']),
    /Deleted item not found/,
  );
});