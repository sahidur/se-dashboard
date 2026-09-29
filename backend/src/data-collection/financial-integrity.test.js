require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const {
  UpsertRevenueActualMonthlyDto,
  UpsertRevenueBudgetMonthlyDto,
  UpsertRevenueDto,
} = require('./dto/index.ts');
const { DataCollectionService } = require('./data-collection.service.ts');
const { FeeCollectionService } = require('../fee-collection/fee-collection.service.ts');
const { FinanceReportsService } = require('../fee-collection/finance-reports.service.ts');
const { StudentFeeStatus } = require('../fee-collection/entities/student-fee.entity.ts');
const { FeeStructureLineDto } = require('../fee-management/dto/fee-management.dto.ts');

const schoolId = '11111111-1111-4111-8111-111111111111';

test('monthly revenue rejects noncanonical months and amounts not storable to cents', () => {
  const invalidMonth = plainToInstance(UpsertRevenueBudgetMonthlyDto, {
    schoolId,
    academicYear: 2026,
    month: 'Sept',
    tuitionFeeTarget: 10,
  });
  const fractionalCent = plainToInstance(UpsertRevenueActualMonthlyDto, {
    schoolId,
    academicYear: 2026,
    month: 'September',
    tuitionFeeAchievement: 0.001,
  });

  assert.ok(validateSync(invalidMonth).some((error) => error.property === 'month'));
  assert.ok(validateSync(fractionalCent).some((error) => error.property === 'tuitionFeeAchievement'));
});

test('legacy revenue rejects negative amounts and collection rates above 100%', () => {
  const dto = plainToInstance(UpsertRevenueDto, {
    schoolId,
    academicYear: 2026,
    totalAnnualRevenue: -1,
    feeCollectionRate: 100.01,
  });
  const properties = validateSync(dto).map((error) => error.property);

  assert.ok(properties.includes('totalAnnualRevenue'));
  assert.ok(properties.includes('feeCollectionRate'));
});

test('fee structure rejects amounts outside its decimal column range', () => {
  const dto = plainToInstance(FeeStructureLineDto, {
    feeHeadId: schoolId,
    amount: 10000000000,
  });

  assert.ok(validateSync(dto).some((error) => error.property === 'amount'));
});

for (const [method, repository] of [
  ['upsertRevenueBudgetMonthly', 'revBudgetMonthlyRepo'],
  ['upsertRevenueActualMonthly', 'revActualMonthlyRepo'],
]) {
  test(`${method} recalculates percentage using persisted values after a partial update`, async () => {
    const service = Object.create(DataCollectionService.prototype);
    service.validateSchoolAccess = async () => ({ schoolCategory: 'brac_primary' });
    service.assertCanEditExisting = async () => undefined;
    service[repository] = {
      findOne: async () => ({
        schoolId,
        academicYear: 2026,
        month: 'January',
        tuitionFeeTarget: '100.00',
        tuitionFeeAchievement: '50.00',
        transportFeeTarget: '500.00',
        transportFeeAchievement: '300.00',
      }),
      save: async (record) => record,
    };

    const record = await service[method]({
      schoolId,
      academicYear: 2026,
      month: 'January',
      tuitionFeeAchievement: 60,
    }, 'user-id', []);

    assert.equal(record.tuitionFeeTarget, '100.00');
    assert.equal(record.collectionPct, 60);
    assert.equal(record.transportFeeTarget, 0);
  });
}

test('dues do not let one overpaid month offset another month debt', async () => {
  const service = Object.create(FinanceReportsService.prototype);
  service.activeFees = async () => [
    {
      studentId: 'student-id',
      student: { admissionNumber: 'A-1', name: 'Student', schoolClass: { name: 'Class 1' }, section: { name: 'A' } },
      payableAmount: '100.00',
      paidAmount: '150.00',
      month: 1,
      status: StudentFeeStatus.OVERPAID,
    },
    {
      studentId: 'student-id',
      student: { admissionNumber: 'A-1', name: 'Student', schoolClass: { name: 'Class 1' }, section: { name: 'A' } },
      payableAmount: '100.00',
      paidAmount: '0.00',
      month: 2,
      status: StudentFeeStatus.DUE,
    },
  ];

  const report = await service.dueReport(schoolId, 'year-id');

  assert.equal(report.rows[0].due, 100);
  assert.deepEqual(report.rows[0].months.map((month) => month.month), [2]);
  assert.equal(report.totalDue, 100);
});

test('AOP summary excludes targets for inactive classes', async () => {
  const service = Object.create(FinanceReportsService.prototype);
  service.yearsRepo = { findOne: async () => ({ id: 'year-id' }) };
  service.classesRepo = { find: async () => [{ id: 'active-class' }] };
  service.aopRepo = {
    find: async () => [
      { schoolId, classId: 'active-class', targetStudents: 2 },
      { schoolId, classId: 'inactive-class', targetStudents: 100 },
    ],
  };
  service.structuresRepo = {
    find: async () => [{
      schoolId,
      classId: 'active-class',
      feeHeadId: 'head-id',
      month: 1,
      amount: '10.00',
      feeHead: { name: 'Tuition', feeSchedule: 'monthly' },
    }],
  };

  const summary = await service.aopPlannedSummary([schoolId], 2026);

  assert.deepEqual(summary.get(schoolId), { planned: 20, targetStudents: 2 });
});

test('fee generation rolls back an individual insert conflict and continues the batch', async () => {
  const queries = [];
  let findCount = 0;
  let saveCount = 0;
  const students = [
    { id: 'student-1', admissionNumber: 'A-1', classId: null, sectionId: null },
    { id: 'student-2', admissionNumber: 'A-2', classId: null, sectionId: null },
  ];
  const manager = {
    find: async () => {
      findCount++;
      return findCount === 1 ? students : [];
    },
    create: (_entity, values) => values,
    query: async (sql) => queries.push(sql),
    save: async (fee) => {
      saveCount++;
      if (saveCount === 1) {
        const error = new Error('duplicate key value violates unique constraint');
        error.driverError = { code: '23505' };
        throw error;
      }
      return fee;
    },
  };
  const service = Object.create(FeeCollectionService.prototype);
  service.dataSource = { transaction: async (callback) => callback(manager) };

  const result = await service.generateFees({
    schoolId,
    academicYearId: 'year-id',
    month: 1,
  });

  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed.length, 0);
  assert.ok(queries.includes('ROLLBACK TO SAVEPOINT fee_generation_0'));
  assert.ok(queries.includes('RELEASE SAVEPOINT fee_generation_0'));
});
