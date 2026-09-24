require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { PERMISSIONS_KEY } = require('../common/decorators/permissions.decorator');
const { FeeManagementController } = require('../fee-management/fee-management.controller');
const { StudentsController } = require('../students/students.controller');
const { UserDesignationsController } = require('../user-designations/user-designations.controller');
const { SaveFeeStructureDto } = require('../fee-management/dto/fee-management.dto');
const { CollectPaymentDto } = require('./dto/fee-collection.dto');
const { StudentsService } = require('../students/students.service');
const { RecycleBinService } = require('../recycle-bin/recycle-bin.service');
const { FeeCollectionService } = require('./fee-collection.service');
const { SchoolScopeGuard } = require('../students/school-scope.guard');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { FeeCollectionController } = require('./fee-collection.controller');
const { FinanceReportsController } = require('./finance-reports.controller');
const { RecycleBinController } = require('../recycle-bin/recycle-bin.controller');
const { JwtAuthGuard } = require('../auth/guards/jwt-auth.guard');

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const c = '33333333-3333-4333-8333-333333333333';

test('catalog read routes require their module read grant', () => {
  for (const [controller, methods, module] of [
    [FeeManagementController, ['findYears', 'findActiveYear', 'findHeads'], 'fee-management'],
    [StudentsController, ['findClasses', 'findSections'], 'student-management'],
    [UserDesignationsController, ['findAll', 'findOne'], 'user-designations'],
  ]) {
    for (const method of methods) {
      assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, controller.prototype[method]),
        [{ module, action: 'read' }]);
    }
  }
});

test('all audited controllers require JWT authentication', () => {
  for (const controller of [FeeManagementController, StudentsController, UserDesignationsController,
    FeeCollectionController, FinanceReportsController, RecycleBinController]) {
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, controller).includes(JwtAuthGuard), controller.name);
  }
  for (const controller of [StudentsController, FeeManagementController, FeeCollectionController, FinanceReportsController]) {
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, controller).includes(SchoolScopeGuard), controller.name);
  }
});

test('fee structure lines reject unexpected fields, invalid values and duplicates', () => {
  const input = { schoolId: a, academicYearId: b, classId: c, month: 1,
    lines: [{ feeHeadId: a, amount: -1, injected: true }, { feeHeadId: a, amount: 12 }] };
  const errors = validateSync(plainToInstance(SaveFeeStructureDto, input),
    { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.some((error) => error.property === 'lines'));
  assert.ok(errors.flatMap((error) => error.children || []).length > 0);
});

test('payment rejects fractional cents and object allocations', () => {
  for (const input of [
    { studentFeeId: a, amount: 1.001, paymentMethod: 'cash' },
    { studentFeeId: a, amount: 1, paymentMethod: 'cash', allocations: { feeHeadId: b, amount: 1 } },
  ]) {
    assert.notEqual(validateSync(plainToInstance(CollectPaymentDto, input)).length, 0);
  }
});

test('student creation refuses a class belonging to another school', async () => {
  const service = new StudentsService({}, { findOne: async () => null }, {});
  await assert.rejects(service.createStudent({ schoolId: a, classId: b }, c), /selected school/);
});

test('promotion refuses students from another school before saving', async () => {
  const save = () => { throw Error('must not save'); };
  const service = new StudentsService(
    { find: async () => [{ id: c, schoolId: a }], save },
    { findOne: async () => ({ id: b, schoolId: b }) },
    { findOne: async () => ({ classId: b }) },
  );
  await assert.rejects(service.promote({ studentIds: [c], targetClassId: b, targetSectionId: c }), /target class school/);
});

test('recycle bin denies missing actors and equal or higher privilege users', async () => {
  const users = { findOne: async ({ where }) => where.id === a
    ? { roles: [{ name: 'Manager', hierarchy: 2 }] }
    : { roles: [{ name: 'Manager', hierarchy: 2 }] } };
  const deleted = { id: b, deletedAt: new Date() };
  let saved = false;
  const repo = { findOne: async () => deleted, save: async () => { saved = true; } };
  const service = new RecycleBinService(undefined, users);
  service.getRepository = () => repo;
  await assert.rejects(service.restore('user', b), /Actor is required/);
  await assert.rejects(service.restore('user', b, a), /more privileges/);
  assert.equal(saved, false);
});

test('receipt returns only display fields of student and no collected-by user', async () => {
  const receipt = { paymentId: a, payment: { id: a }, student: {
    id: b, name: 'Student', admissionNumber: 'ADM', motherNid: 'secret',
    school: { id: c, name: 'School', phone: 'private' },
    schoolClass: null, section: null, academicYear: null,
  } };
  const service = new FeeCollectionService({}, {}, { findOne: async () => receipt }, {}, {});
  const output = await service.findReceipt(a);
  assert.equal(output.student.name, 'Student');
  assert.equal(JSON.stringify(output).includes('secret'), false);
  assert.equal(JSON.stringify(output).includes('private'), false);
});

test('school scope blocks foreign student IDs and unscoped payment lists', async () => {
  const records = new Map([
    [b, { id: b, schoolId: c }],
    [c, { id: c, createdById: b }],
  ]);
  const db = { getRepository: () => ({ findOne: async ({ where }) => records.get(where.id) }) };
  const users = { findOneById: async () => ({ schools: [] }) };
  const guard = new SchoolScopeGuard(db, users);
  const context = (controller, path, params = {}, query = {}) => ({
    getClass: () => ({ name: controller }),
    switchToHttp: () => ({ getRequest: () => ({ route: { path }, params, query, body: {}, user: { id: a, roles: [] } }) }),
  });
  await assert.rejects(guard.canActivate(context('StudentsController', '/api/students/:id', { id: b })), /access denied/);
  await assert.rejects(guard.canActivate(context('FeeCollectionController', '/api/fee-collection/payments')), /access denied/);
  await assert.rejects(guard.canActivate(context('FinanceReportsController', '/api/finance-reports/planned-revenue')), /access denied/);
  records.set(c, { id: c, createdById: a });
  assert.equal(await guard.canActivate(context('StudentsController', '/api/students/:id', { id: b })), true);
});
