/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Security regression checks for the fixes applied in the security audit.
 *
 * Runs against mocked TypeORM repositories — no database connection, no real
 * data. Execute with:
 *   npx ts-node -r tsconfig-paths/register test/security-fixes.check.ts
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { SurveysService } from '../src/surveys/surveys.service';
import { RolesService } from '../src/roles/roles.service';
import { FilesService } from '../src/files/files.service';
import { Survey, SurveyStatus } from '../src/surveys/entities/survey.entity';
import { cookieExtractor } from '../src/auth/strategies/jwt.strategy';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<unknown>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  PASS  ${name}`);
    })
    .catch((e: any) => {
      failed++;
      console.error(`  FAIL  ${name}: ${e?.message}`);
    });
}

function expectForbidden(p: Promise<any>) {
  return p.then(
    () => {
      throw new Error('expected ForbiddenException, got success');
    },
    (e) => {
      if (!(e instanceof ForbiddenException)) {
        throw new Error(`expected ForbiddenException, got ${e?.constructor?.name}: ${e?.message}`);
      }
    },
  );
}

function expectNotFound(p: Promise<any>) {
  return p.then(
    () => {
      throw new Error('expected NotFoundException, got success');
    },
    (e) => {
      if (!(e instanceof NotFoundException)) {
        throw new Error(`expected NotFoundException, got ${e?.constructor?.name}: ${e?.message}`);
      }
    },
  );
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const SUPER_ADMIN_ROLE = { id: 'role-super', name: 'Super Admin', hierarchy: 0, permissions: [] as any[] };
const ADMIN_ROLE = { id: 'role-admin', name: 'Admin', hierarchy: 1, permissions: [] as any[] };
const TEACHER_ROLE = { id: 'role-teacher', name: 'Teacher', hierarchy: 4, permissions: [] as any[] };

const superAdminUser = { id: 'u-super', isActive: true, roles: [SUPER_ADMIN_ROLE], schools: [] };
const adminUser = { id: 'u-admin', isActive: true, roles: [ADMIN_ROLE], schools: [] };
const teacherUser = { id: 'u-teacher', isActive: true, roles: [TEACHER_ROLE], schools: [] };

async function usersTests() {
  console.log('\n[UsersService] privilege-hierarchy guards');

  // Repository mocks
  const targets = new Map<string, any>();
  const mkTarget = (id: string, roles: any[]) => {
    const t: any = { id, isActive: true, roles, refreshToken: undefined as string | null | undefined };
    targets.set(id, t);
    return t;
  };
  const superTarget = mkTarget('u-target-super', [SUPER_ADMIN_ROLE]);
  const teacherTarget = mkTarget('u-target-teacher', [TEACHER_ROLE]);

  let assignedRoles: any[] | null = null;
  const rolesRepo = {
    findBy: async (criteria: any) => {
      const ids = criteria.id as any;
      const wanted: string[] = Array.isArray(ids) ? ids : ids?.value ?? [];
      return [SUPER_ADMIN_ROLE, ADMIN_ROLE, TEACHER_ROLE].filter((r) =>
        wanted.includes(r.id),
      );
    },
  };
  const usersRepo: any = {
    findOne: async (opts: any) => {
      const id = opts?.where?.id;
      if (id === 'u-admin') return { ...adminUser, roles: [...adminUser.roles] };
      if (id === 'u-super') return { ...superAdminUser, roles: [...superAdminUser.roles] };
      return targets.get(id) ?? null;
    },
    findBy: async () => [],
    save: async (u: any) => u,
    update: async (id: string, patch: any) => {
      const t = targets.get(id);
      if (t) Object.assign(t, patch);
    },
    softRemove: async () => undefined,
    createQueryBuilder: () => {
      throw new Error('not expected in these tests');
    },
  };
  const schoolsRepo = { findBy: async () => [] };
  const auditLogRepo = { create: (x: any) => x, save: async () => undefined };

  const svc = new UsersService(
    usersRepo,
    rolesRepo as any,
    schoolsRepo as any,
    auditLogRepo as any,
  );

  await check(
    'Admin CANNOT reset a Super Admin password',
    () => expectForbidden(svc.resetPassword('u-target-super', 'u-admin')),
  );
  await check(
    'Super Admin CAN reset another user password',
    () => svc.resetPassword('u-target-teacher', 'u-super').then((r) => {
      if (!r.newPassword) throw new Error('no password returned');
    }),
  );
  await check(
    'System context (no actor, e.g. seeding) can still reset',
    () => svc.resetPassword('u-target-teacher').then((r) => {
      if (!r.newPassword) throw new Error('no password returned');
    }),
  );
  await check(
    'Admin CANNOT grant the Super Admin role',
    () =>
      expectForbidden(
        svc.assignRoles('u-target-teacher', ['role-super'], 'u-admin'),
      ),
  );
  await check(
    'Admin CAN grant the Teacher role',
    () =>
      svc
        .assignRoles('u-target-teacher', ['role-teacher'], 'u-admin')
        .then((u) => {
          if (!u.roles.some((r: any) => r.id === 'role-teacher')) {
            throw new Error('teacher role not assigned');
          }
        }),
  );
  await check(
    'Admin CANNOT deactivate a Super Admin',
    () => expectForbidden(svc.setStatus('u-target-super', false, 'u-admin')),
  );
  await check(
    'Admin CAN deactivate a Teacher',
    () => svc.setStatus('u-target-teacher', false, 'u-admin'),
  );
  await check(
    'Admin CANNOT delete a Super Admin',
    () => expectForbidden(svc.remove('u-target-super', 'u-admin') as any),
  );
  await check(
    'Admin CANNOT edit a Super Admin profile',
    () =>
      expectForbidden(
        svc.update('u-target-super', { firstName: 'X' } as any, 'u-admin'),
      ),
  );
  await check(
    'User CAN edit own profile (me/profile passes self as actor)',
    () =>
      svc.update('u-admin', { firstName: 'NewName' } as any, 'u-admin').then(
        (u) => {
          if (u.firstName !== 'NewName') throw new Error('profile not updated');
        },
      ),
  );
  await check(
    'password reset revokes refresh token',
    () =>
      svc.resetPassword('u-target-teacher', 'u-admin').then(() => {
        if (teacherTarget.refreshToken !== null) {
          throw new Error('refresh token not cleared');
        }
      }),
  );

  void assignedRoles;
}

async function rolesTests() {
  console.log('\n[RolesService] privilege-hierarchy guards');

  const rolesData = [
    { id: 'role-super', name: 'Super Admin', hierarchy: 0 },
    { id: 'role-admin', name: 'Admin', hierarchy: 1 },
    { id: 'role-viewer', name: 'Viewer', hierarchy: 9 },
  ];
  const rolesRepo: any = {
    findOne: async (opts: any) =>
      rolesData.find((r) => r.id === opts?.where?.id || r.name === opts?.where?.name) ?? null,
    find: async () => rolesData,
    create: (x: any) => x,
    save: async (x: any) => ({ ...x, id: 'role-new' }),
    remove: async () => undefined,
  };
  const permsRepo = { create: (x: any) => x, save: async (x: any) => x, delete: async () => undefined };

  const usersSvcMock = {
    findOneById: async (id: string) => {
      if (id === 'u-admin') return adminUser;
      if (id === 'u-super') return superAdminUser;
      return null;
    },
  } as any;

  const svc = new RolesService(rolesRepo, permsRepo as any, usersSvcMock);

  await check(
    'Admin CANNOT create a role above own level (hierarchy 0)',
    () =>
      expectForbidden(
        svc.create({ name: 'Evil', hierarchy: 0 } as any, 'u-admin'),
      ),
  );
  await check(
    'Admin CAN create a role below own level',
    () => svc.create({ name: 'Helper', hierarchy: 5 } as any, 'u-admin'),
  );
  await check(
    'Admin CANNOT modify the Super Admin role',
    () =>
      expectForbidden(
        svc.update('role-super', { description: 'x' } as any, 'u-admin'),
      ),
  );
  await check(
    'Admin CANNOT modify own held role (self-escalation)',
    () =>
      expectForbidden(
        svc.update('role-admin', { description: 'x' } as any, 'u-admin'),
      ),
  );
  await check(
    'Admin CAN modify an unrelated lower role',
    () => svc.update('role-viewer', { description: 'x' } as any, 'u-admin'),
  );
  await check(
    'Admin CANNOT delete the Super Admin role',
    () => expectForbidden(svc.remove('role-super', 'u-admin') as any),
  );
  await check(
    'Super Admin CAN modify any role',
    () => svc.update('role-admin', { description: 'y' } as any, 'u-super'),
  );
}

async function surveysTests() {
  console.log('\n[SurveysService] IDOR + assignment enforcement');

  const draftSurvey = {
    id: 's-draft',
    status: SurveyStatus.DRAFT,
    createdById: 'u-creator',
  } as unknown as Survey;
  const publishedSurvey = {
    id: 's-pub',
    status: SurveyStatus.PUBLISHED,
    createdById: 'u-creator',
  } as unknown as Survey;

  const surveyRepo: any = {
    findOne: async (opts: any) => {
      const id = opts?.where?.id;
      if (id === draftSurvey.id) return draftSurvey;
      if (id === publishedSurvey.id) return publishedSurvey;
      return null;
    },
  };
  const responseRecord = {
    id: 'r-1',
    respondentId: 'u-respondent',
    surveyId: 's-pub',
  };
  const savedResponses = new Map<string, any>();
  const responsesRepo: any = {
    findOne: async (opts: any) => {
      const id = opts?.where?.id;
      if (id === 'r-1') return responseRecord;
      return savedResponses.get(id) ?? null;
    },
    create: (x: any) => x,
    save: async (x: any) => {
      const rec = { ...x, id: 'r-new', answers: [] };
      savedResponses.set(rec.id, rec);
      return rec;
    },
    find: async () => [],
  };
  const assignments = [
    { surveyId: 's-pub', userId: 'u-assigned', roleId: null, schoolId: null, excludeUserIds: null },
    { surveyId: 's-pub', userId: null, roleId: 'role-teacher', schoolId: null, excludeUserIds: ['u-excluded'] },
    { surveyId: 's-pub', userId: null, roleId: null, schoolId: 'school-1', excludeUserIds: null },
  ];
  const assignmentsRepo: any = { find: async () => assignments };

  const noop = { create: (x: any) => x, save: async (x: any) => x, find: async () => [], delete: async () => undefined, findOne: async () => null };
  const usersSvcMock = {
    findOneById: async (id: string) => {
      if (id === 'u-manager')
        return {
          ...adminUser,
          roles: [
            {
              ...ADMIN_ROLE,
              permissions: [{ module: 'surveys', action: 'read' }],
            },
          ],
        };
      if (id === 'u-responder-perm')
        return {
          ...teacherUser,
          roles: [
            {
              ...TEACHER_ROLE,
              permissions: [{ module: 'surveys', action: 'update' }],
            },
          ],
        };
      if (id === 'u-teacher') return teacherUser;
      if (id === 'u-school-user')
        return { ...teacherUser, schools: [{ id: 'school-1' }] };
      // Default identity: holds NO assigned role/school (Alumni-like).
      return {
        id,
        isActive: true,
        roles: [{ id: 'role-alumni', name: 'Alumni', hierarchy: 5, permissions: [] }],
        schools: [],
      };
    },
    getSchools: async () => [],
  } as any;

  const svc = new SurveysService(
    surveyRepo,
    noop as any, // fields
    noop as any, // sections
    responsesRepo,
    noop as any, // answers
    assignmentsRepo,
    noop as any, // status logs
    noop as any, // school records
    noop as any, // categories
    usersSvcMock,
  );

  await check(
    'Random user CANNOT read someone else\'s DRAFT survey',
    () =>
      expectNotFound(
        svc.findOneForUser(draftSurvey.id, 'u-random', ['Teacher']),
      ),
  );
  await check(
    'Creator CAN read own draft survey',
    () => svc.findOneForUser(draftSurvey.id, 'u-creator', []),
  );
  await check(
    'Manager (surveys:read) CAN read a draft survey',
    () => svc.findOneForUser(draftSurvey.id, 'u-manager', []),
  );
  await check(
    'Any authenticated user CAN read a PUBLISHED survey (fill flow)',
    () => svc.findOneForUser(publishedSurvey.id, 'u-random', []),
  );

  await check(
    'Respondent CAN read own response',
    () => svc.getResponseForUser('r-1', 'u-respondent'),
  );
  await check(
    'Random user CANNOT read someone else\'s response (IDOR fixed)',
    () => expectNotFound(svc.getResponseForUser('r-1', 'u-random')),
  );
  await check(
    'Manager (surveys:read) CAN read any response',
    () => svc.getResponseForUser('r-1', 'u-manager'),
  );

  // Assignment enforcement on submit (draft saves go through submitResponse too)
  const baseSubmit = {
    surveyId: 's-pub',
    answers: [],
    isDraft: true,
  } as any;
  await check(
    'Unassigned user CANNOT respond',
    () => expectForbidden(svc.submitResponse(baseSubmit, 'u-random')),
  );
  await check(
    'Directly assigned user CAN respond',
    () => svc.submitResponse(baseSubmit, 'u-assigned'),
  );
  await check(
    'Role-assigned user CAN respond',
    () => svc.submitResponse(baseSubmit, 'u-teacher'),
  );
  await check(
    'Excluded user CANNOT respond despite role assignment',
    () => expectForbidden(svc.submitResponse(baseSubmit, 'u-excluded')),
  );
  await check(
    'School-assigned user CAN respond',
    () => svc.submitResponse(baseSubmit, 'u-school-user'),
  );
  await check(
    'Manager (surveys:update) CAN respond without assignment (preview)',
    () => svc.submitResponse(baseSubmit, 'u-responder-perm'),
  );
}

async function uploadsTests() {
  console.log('\n[FilesService] signed local upload URLs');

  const makeSvc = (env: Record<string, string>) =>
    new FilesService({
      get: (key: string, def?: any) => (key in env ? env[key] : def),
    } as any);

  await check(
    'signed URL round-trips through verification',
    () => {
      const svc = makeSvc({ JWT_SECRET: 'x'.repeat(64) });
      const url = svc.signUploadPath('uploads/abc.jpg');
      if (!url.startsWith('/api/uploads/uploads/abc.jpg?')) {
        throw new Error(`unexpected url shape: ${url}`);
      }
      const q = new URLSearchParams(url.split('?')[1]);
      if (!svc.verifyLocalRequest('uploads/abc.jpg', q.get('x-exp')!, q.get('x-sig')!)) {
        throw new Error('valid signature rejected');
      }
    },
  );
  await check(
    'tampered signature is rejected',
    () => {
      const svc = makeSvc({ JWT_SECRET: 'x'.repeat(64) });
      const url = svc.signUploadPath('uploads/abc.jpg');
      const q = new URLSearchParams(url.split('?')[1]);
      const badSig = q.get('x-sig')!.slice(0, -2) + 'AA';
      if (svc.verifyLocalRequest('uploads/abc.jpg', q.get('x-exp')!, badSig)) {
        throw new Error('tampered signature accepted');
      }
    },
  );
  await check(
    'expired signature is rejected',
    () => {
      const { createHash, createHmac } = require('crypto');
      const secret = createHash('sha256')
        .update('upload-url:' + 'x'.repeat(64))
        .digest('hex');
      // Same derivation as FilesService.uploadUrlSecret(); craft a properly
      // signed URL whose x-exp lies in the past.
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const sig = createHmac('sha256', secret)
        .update(`uploads/abc.jpg|${exp}`)
        .digest('base64url');
      const svc = makeSvc({ JWT_SECRET: 'x'.repeat(64) });
      if (svc.verifyLocalRequest('uploads/abc.jpg', String(exp), sig)) {
        throw new Error('expired URL accepted');
      }
    },
  );
  await check(
    'path traversal keys are rejected',
    () => {
      const svc = makeSvc({ JWT_SECRET: 'x'.repeat(64) });
      if (svc.verifyLocalRequest('../../.env', undefined, undefined)) {
        throw new Error('traversal key accepted');
      }
    },
  );
  await check(
    'unsigned legacy URLs allowed by default, rejected when flag disabled',
    () => {
      const permissive = makeSvc({ JWT_SECRET: 'x'.repeat(64) });
      if (!permissive.verifyLocalRequest('uploads/a.jpg', undefined, undefined)) {
        throw new Error('legacy unsigned URL should be allowed during migration');
      }
      const strict = makeSvc({
        JWT_SECRET: 'x'.repeat(64),
        UPLOADS_ALLOW_UNSIGNED: 'false',
      });
      if (strict.verifyLocalRequest('uploads/a.jpg', undefined, undefined)) {
        throw new Error('unsigned URL should be rejected when grace disabled');
      }
    },
  );
}

async function pinTests() {
  console.log('\n[UsersService] PIN minimisation');

  const targetUser: any = {
    id: 'u-target',
    email: 't@b.org',
    pin: 4321,
    roles: [TEACHER_ROLE],
  };
  const usersRepo: any = {
    findOne: async (opts: any) => {
      const id = opts?.where?.id;
      if (id === 'u-target') return { ...targetUser };
      if (id === 'u-admin') return { ...adminUser };
      if (id === 'u-super') return { ...superAdminUser };
      return null;
    },
  };
  const svc = new UsersService(
    usersRepo,
    { findBy: async () => [] } as any,
    { findBy: async () => [] } as any,
    { create: (x: any) => x, save: async () => undefined } as any,
  );

  await check(
    'plain Admin does NOT see another user\'s PIN',
    () =>
      svc.findOneForViewer('u-target', 'u-admin').then((u: any) => {
        if ('pin' in u && u.pin !== undefined) throw new Error('pin leaked');
      }),
  );
  await check(
    'user sees own PIN',
    () =>
      svc.findOneForViewer('u-target', 'u-target').then((u: any) => {
        if (u.pin !== 4321) throw new Error('own pin missing');
      }),
  );
  await check(
    'Super Admin sees other user PINs (admin workflow)',
    () =>
      svc.findOneForViewer('u-target', 'u-super').then((u: any) => {
        if (u.pin !== 4321) throw new Error('super admin pin missing');
      }),
  );

  // findAll must not select the pin column at all.
  let selectedColumns: string[] = [];
  const qbChain: any = {
    leftJoinAndSelect: () => qbChain,
    select: (cols: string[]) => {
      selectedColumns = cols;
      return qbChain;
    },
    where: () => qbChain,
    orderBy: () => qbChain,
    skip: () => qbChain,
    take: () => qbChain,
    getManyAndCount: async () => [[], 0],
  };
  const listSvc = new UsersService(
    {
      createQueryBuilder: () => qbChain,
    } as any,
    { findBy: async () => [] } as any,
    { findBy: async () => [] } as any,
    { create: (x: any) => x, save: async () => undefined } as any,
  );
  await check(
    'findAll listing never selects the pin column',
    () =>
      listSvc.findAll(1, 20).then(() => {
        if (selectedColumns.includes('user.pin')) {
          throw new Error('user.pin still selected in listing query');
        }
      }),
  );
}

async function cookieTests() {
  console.log('\n[JwtStrategy] cookie extractor');

  await check(
    'extractor reads bep_at cookie from request',
    () => {
      const token = cookieExtractor({ cookies: { bep_at: 'tok' } } as any);
      if (token !== 'tok') throw new Error(`got ${token}`);
    },
  );
  await check(
    'extractor returns null without cookies/request',
    () => {
      if (cookieExtractor(undefined) !== null) throw new Error('non-null for no req');
      if (cookieExtractor({} as any) !== null) throw new Error('non-null for empty req');
    },
  );
}

(async () => {
  console.log('Security fix regression checks');
  await usersTests();
  await rolesTests();
  await surveysTests();
  await uploadsTests();
  await pinTests();
  await cookieTests();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
