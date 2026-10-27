require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FeeReconcileService } = require('./fee-reconcile.service.ts');
const { FeeCollectionService } = require('./fee-collection.service.ts');

const YEAR = { id: 'y2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' };
const TUITION = { id: 'h-tuition', name: 'Tuition', feeSchedule: 'monthly', applicableTo: 'all' };
const ADMISSION = { id: 'h-adm', name: 'Admission Fee', feeSchedule: 'yearly', applicableTo: 'new_students' };
const SESSION = { id: 'h-ses', name: 'Session Fee', feeSchedule: 'yearly', applicableTo: 'existing_students' };

const row = (head, month, amount) => ({
  schoolId: 's1',
  academicYearId: YEAR.id,
  classId: 'c1',
  month,
  feeHeadId: head.id,
  feeHead: head,
  amount: String(amount),
});
const STRUCTURE = [
  ...Array.from({ length: 12 }, (_, i) => row(TUITION, i + 1, 1000)),
  row(ADMISSION, 1, 500),
  row(SESSION, 1, 300),
];

const line = (head, amount) => ({ feeHeadId: head.id, feeHeadName: head.name, base: amount, discount: 0, payable: amount });
const feeEntity = (month, overrides = {}) => ({
  id: `fee-${month}`,
  studentId: 'st1',
  schoolId: 's1',
  academicYearId: YEAR.id,
  classId: 'c1',
  sectionId: null,
  month,
  status: 'due',
  baseAmount: '1000.00',
  discountAmount: '0.00',
  payableAmount: '1000.00',
  paidAmount: '0.00',
  breakdown: [line(TUITION, 1000)],
  voidSource: null,
  deletedAt: null,
  ...overrides,
});

function fakeManager(data, { failCreateWith } = {}) {
  const saved = [];
  const queries = [];
  return {
    saved,
    queries,
    findOne: async () => data.Student,
    find: async (Entity) => data[Entity.name] ?? [],
    create: (Entity, values) => Object.assign(new Entity(), values),
    save: async (entity) => {
      if (failCreateWith && entity?.constructor?.name === 'StudentFee' && !entity.id) throw failCreateWith;
      saved.push(entity);
      return entity;
    },
    query: async (sql) => queries.push(sql),
    createQueryBuilder: () => {
      const qb = {
        select: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getRawOne: async () => ({ max: data.latestMonth ?? null }),
      };
      return qb;
    },
  };
}

const student = (overrides = {}) => ({
  id: 'st1',
  schoolId: 's1',
  classId: 'c1',
  sectionId: null,
  academicYearId: YEAR.id,
  status: 'active',
  admissionDate: '2026-07-20',
  studentType: null,
  studentTypeAcademicYearId: null,
  ...overrides,
});

const service = () => new FeeReconcileService({});

test('reconcile voids unpaid pre-admission rows, flags paid ones and never touches payments', async () => {
  const unpaidJan = feeEntity(1);
  const paidFeb = feeEntity(2, { status: 'paid', paidAmount: '1000.00' });
  const payments = [{ id: 'p1', studentFeeId: 'fee-2', amount: '1000.00', status: 'completed', allocations: [] }];
  const manager = fakeManager({
    Student: student(),
    StudentFee: [unpaidJan, paidFeb],
    AcademicYear: [YEAR],
    FeeStructure: STRUCTURE,
    Payment: payments,
    latestMonth: 7,
  });

  const result = await service().reconcileStudentInManager(manager, 'st1', { actorId: 'user-1' });

  assert.equal(unpaidJan.status, 'cancelled');
  assert.equal(unpaidJan.voidSource, 'admission_date');
  assert.equal(unpaidJan.voidedById, 'user-1');
  assert.ok(unpaidJan.voidedAt instanceof Date);
  assert.ok(unpaidJan.voidReason);

  // The paid month is untouched and only a review record is created.
  assert.equal(paidFeb.status, 'paid');
  assert.equal(paidFeb.paidAmount, '1000.00');
  assert.equal(manager.saved.includes(paidFeb), false);
  const adjustment = manager.saved.find((e) => e.constructor.name === 'FeeAdjustment');
  assert.equal(adjustment.kind, 'pre_admission_payment');
  assert.equal(adjustment.amount, '1000.00');
  assert.equal(adjustment.studentFeeId, 'fee-2');
  assert.equal(adjustment.status, 'open');

  // Payments / receipts are never written.
  assert.equal(manager.saved.some((e) => ['Payment', 'Receipt'].includes(e.constructor.name)), false);

  // July (the admission month) is created because the class has generated it.
  const created = manager.saved.find((e) => e.constructor.name === 'StudentFee' && e.month === 7);
  assert.ok(created);
  assert.equal(created.payableAmount, '1500.00'); // tuition + admission fee (catch-up)
  assert.equal(created.paidAmount, '0.00');

  assert.deepEqual(result.summary, { voided: 1, reinstated: 0, rebuilt: 0, adjusted: 0, created: 1, flagged: 1, dismissed: 0 });
});

test('reconcile is a no-op for a student whose dues already follow the rules', async () => {
  const manager = fakeManager({
    Student: student({ admissionDate: '2026-01-10' }),
    StudentFee: [
      feeEntity(1, {
        breakdown: [line(TUITION, 1000), line(ADMISSION, 500)],
        baseAmount: '1500.00',
        payableAmount: '1500.00',
      }),
    ],
    AcademicYear: [YEAR],
    FeeStructure: STRUCTURE,
    latestMonth: 1,
  });
  const result = await service().reconcileStudentInManager(manager, 'st1', {});
  assert.equal(manager.saved.length, 0);
  assert.deepEqual(result.actions, []);
});

test('reconcile survives a concurrent generation winning the unique insert', async () => {
  const duplicate = Object.assign(new Error('duplicate key'), { driverError: { code: '23505' } });
  const manager = fakeManager(
    { Student: student(), StudentFee: [], AcademicYear: [YEAR], FeeStructure: STRUCTURE, latestMonth: 7 },
    { failCreateWith: duplicate },
  );
  const result = await service().reconcileStudentInManager(manager, 'st1', {});
  assert.equal(result.summary.created, 0);
  assert.ok(manager.queries.some((q) => q.startsWith('ROLLBACK TO SAVEPOINT')));
  assert.ok(manager.queries.some((q) => q.startsWith('RELEASE SAVEPOINT')));
});

test('reconcile returns nothing for an unknown student', async () => {
  const manager = fakeManager({ Student: null });
  const result = await service().reconcileStudentInManager(manager, 'missing', {});
  assert.equal(result.actions.length, 0);
});

// ---------------- generateFees with the admission rules on ----------------

async function generate(month, studentOverrides) {
  process.env.FEE_ADMISSION_RULES = 'on';
  try {
    const students = [student(studentOverrides)];
    const manager = {
      find: async (Entity) =>
        ({ Student: students, StudentFee: [], FeeStructure: STRUCTURE, StudentDiscount: [], AcademicYear: [YEAR] })[Entity.name] ?? [],
      create: (_Entity, values) => values,
      save: async (entity) => {
        manager.saved.push(entity);
        return entity;
      },
      query: async () => undefined,
      saved: [],
    };
    const svc = Object.create(FeeCollectionService.prototype);
    svc.dataSource = { transaction: async (cb) => cb(manager) };
    const result = await svc.generateFees({ schoolId: 's1', academicYearId: YEAR.id, month });
    return { result, manager };
  } finally {
    delete process.env.FEE_ADMISSION_RULES;
  }
}

test('generateFees creates no due for months before the admission month', async () => {
  const { result, manager } = await generate(3, { admissionDate: '2026-07-20' });
  assert.equal(result.created, 0);
  assert.equal(result.notAdmitted, 1);
  assert.equal(manager.saved.length, 0);
});

test('generateFees bills the admission month in full with the new-student heads', async () => {
  const { result, manager } = await generate(7, { admissionDate: '2026-07-31' });
  assert.equal(result.created, 1);
  assert.equal(result.notAdmitted, 0);
  const fee = manager.saved[0];
  assert.deepEqual(fee.breakdown.map((b) => b.feeHeadName).sort(), ['Admission Fee', 'Tuition']);
  assert.equal(fee.payableAmount, '1500.00');
});

test('generateFees charges existing students the session fee instead of the admission fee', async () => {
  const { manager } = await generate(1, { admissionDate: '2023-04-01' });
  const fee = manager.saved[0];
  assert.deepEqual(fee.breakdown.map((b) => b.feeHeadName).sort(), ['Session Fee', 'Tuition']);
});

test('generateFees keeps the legacy behaviour when the rules are off', async () => {
  delete process.env.FEE_ADMISSION_RULES;
  const students = [student({ admissionDate: '2026-07-20' })];
  const manager = {
    find: async (Entity) =>
      ({ Student: students, StudentFee: [], FeeStructure: STRUCTURE.filter((s) => s.month === 3), StudentDiscount: [] })[Entity.name] ?? [],
    create: (_Entity, values) => values,
    save: async (entity) => entity,
    query: async () => undefined,
  };
  const svc = Object.create(FeeCollectionService.prototype);
  svc.dataSource = { transaction: async (cb) => cb(manager) };
  const result = await svc.generateFees({ schoolId: 's1', academicYearId: YEAR.id, month: 3 });
  assert.equal(result.created, 1);
  assert.equal(result.notAdmitted, 0);
});

test('preview can assume fee-head settings that are not saved yet', async () => {
  // Stored heads still charge everyone; the override makes Admission Fee new-only.
  const storedAdmission = { ...ADMISSION, applicableTo: 'all' };
  const structure = [
    ...STRUCTURE.filter((s) => s.feeHeadId !== ADMISSION.id && s.feeHeadId !== SESSION.id),
    { ...row(ADMISSION, 1, 500), feeHead: storedAdmission },
  ];
  const january = feeEntity(1, {
    breakdown: [line(TUITION, 1000), line(ADMISSION, 500)],
    baseAmount: '1500.00',
    payableAmount: '1500.00',
  });
  const make = () =>
    fakeManager({
      Student: student({ admissionDate: '2023-02-01' }),
      StudentFee: [january],
      AcademicYear: [YEAR],
      FeeStructure: structure,
      FeeHead: [storedAdmission],
    });

  const without = await service().reconcileStudentInManager(make(), 'st1', {});
  assert.equal(without.actions.length, 0);

  const withOverride = await service().reconcileStudentInManager(make(), 'st1', {
    headOverrides: new Map([[ADMISSION.id, { applicableTo: 'new_students' }]]),
  });
  assert.equal(withOverride.actions[0].type, 'rebuild');
  assert.deepEqual(withOverride.actions[0].breakdown.map((b) => b.feeHeadName), ['Tuition']);
});

// ---------------- voided (cancelled) rows never count as dues ----------------

const voided = (month) => ({
  ...feeEntity(month, { status: 'cancelled', voidSource: 'admission_date', payableAmount: '1500.00' }),
});

test('monthly collection treats a voided month as not billed and adds nothing to total due', async () => {
  const svc = Object.create(FeeCollectionService.prototype);
  svc.logger = { warn() {} };
  svc.dataSource = { transaction: async () => ({}) };
  svc.studentsRepo = { find: async () => [{ id: 'st1', admissionNumber: 'A', name: 'N', schoolClass: null, section: null }] };
  svc.feesRepo = { find: async () => [voided(3), feeEntity(7)] };

  const march = await svc.monthlyCollection('s1', YEAR.id, 3);
  assert.equal(march[0].currentFee, null);
  assert.equal(march[0].totalDue, 0);
  assert.equal(march[0].previousDue, 0);

  // July: the earlier voided month is not an arrear either.
  const july = await svc.monthlyCollection('s1', YEAR.id, 7);
  assert.equal(july[0].previousDue, 0);
  assert.equal(july[0].totalDue, 1000);
});

test('student fee summary leaves voided months out of totals and the month list', async () => {
  const svc = Object.create(FeeCollectionService.prototype);
  svc.logger = { warn() {} };
  svc.feesRepo = { find: async () => [voided(3), feeEntity(7)] };
  svc.syncStudentFeeSnapshots = async () => undefined;
  const summary = await svc.studentFeeSummary('st1');
  assert.equal(summary.payableAmount, 1000);
  assert.equal(summary.dueAmount, 1000);
  assert.deepEqual(summary.months.map((m) => m.month), [7]);
});

test('adjustments list orders by property names (raw column names crash TypeORM paging) and works without a school', async () => {
  const calls = { orderBy: [], where: [] };
  const qb = {
    leftJoinAndSelect: () => qb,
    orderBy: (...a) => { calls.orderBy.push(a[0]); return qb; },
    addOrderBy: (...a) => { calls.orderBy.push(a[0]); return qb; },
    skip: () => qb,
    take: () => qb,
    andWhere: (sql) => { calls.where.push(sql); return qb; },
    getManyAndCount: async () => [[{ id: 'a1', amount: '500.00', student: { name: 'N', admissionNumber: 'A-1', school: { name: 'School X' } }, details: {} }], 1],
  };
  const svc = new FeeReconcileService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  const result = await svc.listAdjustments({ status: 'open' });
  assert.deepEqual(calls.orderBy, ['a.createdAt', 'a.id']);
  assert.ok(calls.orderBy.every((c) => !c.includes('_')));
  assert.deepEqual(calls.where, ['a.status = :status']); // no school filter => all schools
  assert.equal(result.items[0].schoolName, 'School X');
  assert.equal(result.total, 1);
});

test('reconcile bills Session Fee to an old student who paid only the Admission Fee, without touching the payment', async () => {
  const paidJan = feeEntity(1, {
    status: 'paid',
    paidAmount: '1500.00',
    breakdown: [line(TUITION, 1000), line(ADMISSION, 500)],
    baseAmount: '1500.00',
    payableAmount: '1500.00',
  });
  const payments = [
    { id: 'p1', studentFeeId: 'fee-1', amount: '1500.00', status: 'completed', allocations: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', amount: 1000 },
      { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', amount: 500 },
    ] },
  ];
  const manager = fakeManager({
    Student: student({ admissionDate: '2023-02-01' }),
    StudentFee: [paidJan],
    AcademicYear: [YEAR],
    FeeStructure: STRUCTURE,
    Payment: payments,
    FeeHead: [ADMISSION, TUITION],
    latestMonth: 1,
  });
  const result = await service().reconcileStudentInManager(manager, 'st1', {});

  // Billed side: Session Fee added, so the month is no longer fully paid.
  assert.deepEqual(paidJan.breakdown.map((b) => b.feeHeadName), ['Tuition', 'Admission Fee', 'Session Fee']);
  assert.equal(paidJan.payableAmount, '1800.00');
  assert.equal(paidJan.status, 'partial');
  // Money side: untouched.
  assert.equal(paidJan.paidAmount, '1500.00');
  assert.equal(manager.saved.some((e) => ['Payment', 'Receipt'].includes(e.constructor.name)), false);
  assert.equal(payments[0].amount, '1500.00');
  // The paid Admission Fee is queued for Finance, noting what is now billed.
  const adjustment = manager.saved.find((e) => e.constructor.name === 'FeeAdjustment');
  assert.equal(adjustment.kind, 'inapplicable_head_payment');
  assert.equal(adjustment.amount, '500.00');
  assert.deepEqual(adjustment.details.nowBilled.map((b) => b.feeHeadName), ['Session Fee']);
  assert.equal(result.summary.adjusted, 1);
  assert.equal(result.summary.flagged, 1);
});
