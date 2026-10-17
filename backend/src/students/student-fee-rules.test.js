require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StudentsService } = require('./students.service.ts');

const YEAR_A = 'year-2026';
const YEAR_B = 'year-2027';

function setup(studentOverrides = {}) {
  const student = {
    id: 'st1',
    schoolId: 's1',
    classId: 'c1',
    sectionId: null,
    academicYearId: YEAR_A,
    admissionDate: '2026-07-10',
    status: 'active',
    studentType: null,
    studentTypeAcademicYearId: null,
    ...studentOverrides,
  };
  const calls = { reconcile: [], saves: 0, transactions: 0 };
  const manager = { save: async (s) => { calls.saves++; return s; } };
  const studentsRepo = {
    findOne: async () => student,
    save: async (s) => { calls.saves++; return s; },
    manager: {
      transaction: async (cb) => { calls.transactions++; return cb(manager); },
    },
  };
  const reconcile = {
    reconcileStudent: async (id, opts, m) => {
      calls.reconcile.push({ id, opts, usedTransaction: m === manager });
      return { summary: { voided: 1, reinstated: 0, rebuilt: 0, created: 0, flagged: 0, dismissed: 0 }, actions: [] };
    },
  };
  const service = new StudentsService(studentsRepo, {}, {}, reconcile);
  return { service, student, calls };
}

test('changing the admission date recalculates dues in the same transaction', async () => {
  process.env.FEE_ADMISSION_RULES = 'on';
  try {
    const { service, calls } = setup();
    const saved = await service.updateStudent('st1', { admissionDate: '2026-09-01' }, 'user-1');
    assert.equal(calls.transactions, 1);
    assert.deepEqual(calls.reconcile, [{ id: 'st1', opts: { actorId: 'user-1' }, usedTransaction: true }]);
    assert.equal(saved.feeReconcile.voided, 1);
  } finally {
    delete process.env.FEE_ADMISSION_RULES;
  }
});

test('edits unrelated to fees do not trigger a recalculation', async () => {
  process.env.FEE_ADMISSION_RULES = 'on';
  try {
    const { service, calls } = setup();
    await service.updateStudent('st1', { name: 'New Name', admissionDate: '2026-07-10' }, 'user-1');
    assert.equal(calls.reconcile.length, 0);
    assert.equal(calls.transactions, 0);
  } finally {
    delete process.env.FEE_ADMISSION_RULES;
  }
});

test('nothing is recalculated while the admission rules flag is off', async () => {
  delete process.env.FEE_ADMISSION_RULES;
  const { service, calls } = setup();
  await service.updateStudent('st1', { admissionDate: '2026-09-01' }, 'user-1');
  assert.equal(calls.reconcile.length, 0);
  assert.equal(calls.saves, 1);
});

test('student type is bound to the current academic year and triggers a recalculation', async () => {
  process.env.FEE_ADMISSION_RULES = 'on';
  try {
    const { service, student, calls } = setup();
    await service.updateStudent('st1', { studentType: 'existing' }, 'user-1');
    assert.equal(student.studentType, 'existing');
    assert.equal(student.studentTypeAcademicYearId, YEAR_A);
    assert.equal(calls.reconcile.length, 1);
  } finally {
    delete process.env.FEE_ADMISSION_RULES;
  }
});

test('student type can be cleared back to automatic for the current year', async () => {
  const { service, student } = setup({ studentType: 'new', studentTypeAcademicYearId: YEAR_A });
  await service.updateStudent('st1', { studentType: null }, 'user-1');
  assert.equal(student.studentType, null);
  assert.equal(student.studentTypeAcademicYearId, null);
});

test('a marker from an earlier academic year is history and is not cleared by a blank form', async () => {
  const { service, student } = setup({
    academicYearId: YEAR_B,
    studentType: 'new',
    studentTypeAcademicYearId: YEAR_A,
  });
  await service.updateStudent('st1', { studentType: null, name: 'x' }, 'user-1');
  assert.equal(student.studentType, 'new');
  assert.equal(student.studentTypeAcademicYearId, YEAR_A);
});

test('setting a student type needs an academic year', async () => {
  const { service } = setup({ academicYearId: null });
  await assert.rejects(service.updateStudent('st1', { studentType: 'new' }, 'u'), /academic year/);
});
