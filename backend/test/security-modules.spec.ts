import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from '../src/roles/roles.service';
import { SurveysService } from '../src/surveys/surveys.service';
import { SurveyStatus } from '../src/surveys/entities/survey.entity';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { SchoolScopeGuard } from '../src/students/school-scope.guard';
import { Student } from '../src/students/entities/student.entity';

const actor = { id: 'actor', roles: [{ id: 'admin-role', name: 'Admin', hierarchy: 1, permissions: [
  { module: 'roles', action: 'create' }, { module: 'roles', action: 'update' },
] }] };

test('non-super-admin cannot create or rename a role to a privileged name', async () => {
  const service = new RolesService(
    { findOne: async () => null } as any, {} as any,
    { findOneById: async () => actor } as any, {} as any,
  );
  for (const name of ['Super Admin', 'Admin']) {
    await assert.rejects(service.create({ name, hierarchy: 1 } as any, actor.id), ForbiddenException);
    (service as any).rolesRepository.findOne = async () => ({ id: 'other-role', name: 'Other', hierarchy: 1, permissions: [] });
    await assert.rejects(service.update('other-role', { name }, actor.id), ForbiddenException);
  }
});

test('role seeding cannot add permissions to an existing non-super-admin role', async () => {
  const service = new RolesService({ findOne: async () => { throw new Error('must not query roles'); } } as any,
    {} as any, { findOneById: async () => actor } as any, {} as any);
  await assert.rejects(service.seedDefaultRoles(actor.id), ForbiddenException);
});

test('a missing acting user is never treated as a trusted internal caller', async () => {
  const service = new RolesService({ findOne: async () => null } as any, {} as any,
    { findOneById: async () => null } as any, {} as any);
  await assert.rejects(service.create({ name: 'Super Admin' } as any, 'missing-user'), ForbiddenException);
});

function surveys(repos: Record<string, any> = {}, user: any = actor): SurveysService {
  return new SurveysService(
    repos.surveys ?? {} as any, {} as any, {} as any,
    repos.responses ?? {} as any, repos.answers ?? {} as any,
    repos.assignments ?? {} as any, {} as any, {} as any, {} as any,
    { findOneById: async () => user } as any,
  );
}

test('survey update cannot bypass status transitions', async () => {
  let saved = false;
  const service = surveys({ surveys: {
    findOne: async () => ({ id: 'survey', createdById: 'owner', status: SurveyStatus.DRAFT }),
    save: async () => { saved = true; },
  } });
  await assert.rejects(service.update('survey', { status: SurveyStatus.ARCHIVED }, 'owner'), BadRequestException);
  assert.equal(saved, false);
});

test('creating a published survey sets the permanent publication flag', async () => {
  let created: any;
  const service = surveys({ surveys: {
    create: (value: any) => { created = value; return value; },
    save: async () => ({ id: 'survey' }),
  } });
  (service as any).findOne = async () => created;
  await service.create({ title: 'Survey', category: 'education', status: SurveyStatus.PUBLISHED } as any, 'owner');
  assert.equal(created.wasPublished, true);
});

test('non-manager cannot read draft surveys or see published assignment identities', async () => {
  const teacher = { id: 'teacher', roles: [{ name: 'Teacher', permissions: [{ module: 'surveys', action: 'read' }] }] };
  const repo = { findOne: async () => ({ id: 'survey', createdById: 'other', status: SurveyStatus.DRAFT,
    assignments: [{ user: { email: 'respondent@example.com' } }] }) };
  const service = surveys({ surveys: repo }, teacher);
  await assert.rejects(service.findOneForUser('survey', 'teacher', ['Teacher']), NotFoundException);
  repo.findOne = async () => ({ id: 'survey', createdById: 'other', status: SurveyStatus.PUBLISHED,
    assignments: [{ user: { email: 'respondent@example.com' } }] });
  const result = await service.findOneForUser('survey', 'teacher', ['Teacher']);
  assert.deepEqual(result.assignments, []);
});

test('non-manager survey list restricts draft rows in the database query', async () => {
  const clauses: string[] = [];
  const qb: any = {
    leftJoinAndSelect: () => qb, select: () => qb,
    andWhere: (clause: string) => { clauses.push(clause); return qb; },
    orderBy: () => qb, addOrderBy: () => qb, skip: () => qb, take: () => qb,
    getManyAndCount: async () => [[], 0],
  };
  const teacher = { roles: [{ name: 'Teacher', permissions: [{ module: 'surveys', action: 'read' }] }] };
  await surveys({ surveys: { createQueryBuilder: () => qb } }, teacher).findAll(1, 20, {}, 'teacher');
  assert.ok(clauses.some((clause) => clause.includes('survey.status = :published')));
});

test('response submission refuses another survey draft and completed responses', async () => {
  for (const existing of [
    { id: 'response', respondentId: 'owner', surveyId: 'other', isComplete: false },
    { id: 'response', respondentId: 'owner', surveyId: 'survey', isComplete: true },
  ]) {
    let saved = false;
    const service = surveys({
      surveys: { findOne: async () => ({ id: 'survey', status: SurveyStatus.PUBLISHED, fields: [], sections: [] }) },
      assignments: { find: async () => [{ userId: 'owner' }] },
      responses: { findOne: async () => existing, save: async () => { saved = true; } },
    });
    await assert.rejects(service.submitResponse({ surveyId: 'survey', responseId: 'response', answers: [] }, 'owner'), NotFoundException);
    assert.equal(saved, false);
  }
});

test('response submission rejects fields belonging to another survey', async () => {
  const service = surveys({
    surveys: { findOne: async () => ({ id: 'survey', status: SurveyStatus.PUBLISHED, fields: [{ id: 'own' }], sections: [] }) },
    assignments: { find: async () => [{ userId: 'owner' }] },
  });
  await assert.rejects(service.submitResponse({ surveyId: 'survey', answers: [{ fieldId: 'foreign' }] } as any, 'owner'), BadRequestException);
});

test('individual response with another respondent is not readable with surveys:read alone', async () => {
  const teacher = { id: 'teacher', roles: [{ name: 'Teacher', permissions: [{ module: 'surveys', action: 'read' }] }] };
  const service = surveys({ responses: { findOne: async () => ({ id: 'response', respondentId: 'someone-else' }) } }, teacher);
  await assert.rejects(service.getResponseForUser('response', 'teacher'), NotFoundException);
});

test('local file serve denies an unsigned key before accessing the filesystem', async () => {
  const controller = new FilesController({ verifyLocalRequest: () => false } as any);
  await assert.rejects(controller.serveLocalFile('uploads/photo.png', undefined as any, undefined as any, {} as any), NotFoundException);
});

test('S3 uploads are private and return an authenticated API URL', async () => {
  const config = { get: (name: string, fallback?: string) => ({
    S3_ACCESS_KEY: 'test-key', S3_SECRET_KEY: 'test-secret', S3_FOLDER: 'bep-se',
  })[name] ?? fallback };
  const service = new FilesService(config as any);
  let command: any;
  (service as any).s3Client = { send: async (input: any) => { command = input; return {}; } };
  const { url, key } = await service.uploadFile({
    mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  } as any);
  assert.equal(command.input.ACL, 'private');
  assert.equal(url, `/api/files/object?key=${encodeURIComponent(key)}`);
  assert.ok(!url.includes('digitaloceanspaces.com'));
  await assert.rejects(service.getPrivateObject('other-app/uploads/photo.png'), BadRequestException);
});

test('finance ledger checks student school even before any fee has been generated', async () => {
  const db = { getRepository: (entity: any) => entity === Student
    ? { findOne: async () => ({ id: 'student', schoolId: 'other-school' }) }
    : { findOne: async () => ({ id: 'other-school', createdById: 'other-user' }), find: async () => [] } };
  const guard = new SchoolScopeGuard(db as any, { findOneById: async () => ({ schools: [] }) } as any);
  const request = { params: { studentId: 'student' }, query: {}, body: {}, user: { id: 'viewer', roles: [] }, route: { path: '/api/finance-reports/students/:studentId/ledger' } };
  await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => request }), getClass: () => ({ name: 'FinanceReportsController' }) } as any), NotFoundException);
});
