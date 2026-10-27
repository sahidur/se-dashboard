require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveStudentFeeContext,
  selectStructureRows,
  headApplies,
  isAdmissionRulesEnabled,
  buildBreakdown,
  computeFeeTotals,
} = require('../fee-management/fee-calculation.ts');
const { planStudentReconcile } = require('./fee-reconcile.planner.ts');

const YEAR = { id: 'y2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' };

const head = (id, name, feeSchedule, applicableTo = 'all') => ({
  id,
  name,
  feeSchedule,
  applicableTo,
});
const TUITION = head('h-tuition', 'Tuition', 'monthly');
const ADMISSION = head('h-adm', 'Admission Fee', 'yearly', 'new_students');
const SESSION = head('h-ses', 'Session Fee', 'yearly', 'existing_students');
const HALF = head('h-half', 'Term Fee', 'half_yearly');

const row = (h, month, amount, classId = 'c1') => ({
  schoolId: 's1',
  academicYearId: YEAR.id,
  classId,
  month,
  feeHeadId: h.id,
  feeHead: h,
  amount: String(amount),
});

// Class structure for the whole year: tuition every month, admission/session in
// January (their scheduled month), half-yearly term fee in July.
const STRUCTURE = [
  ...Array.from({ length: 12 }, (_, i) => row(TUITION, i + 1, 1000)),
  row(ADMISSION, 1, 500),
  row(SESSION, 1, 300),
  row(HALF, 7, 200),
];

const names = (rows) => rows.map((r) => r.feeHead.name).sort();
const select = (student, month) =>
  selectStructureRows(STRUCTURE, resolveStudentFeeContext(student, YEAR), month);

test('admission rules stay off unless FEE_ADMISSION_RULES=on', () => {
  const prev = process.env.FEE_ADMISSION_RULES;
  delete process.env.FEE_ADMISSION_RULES;
  assert.equal(isAdmissionRulesEnabled(), false);
  process.env.FEE_ADMISSION_RULES = 'on';
  assert.equal(isAdmissionRulesEnabled(), true);
  if (prev === undefined) delete process.env.FEE_ADMISSION_RULES;
  else process.env.FEE_ADMISSION_RULES = prev;
});

test('context: first billable month and new/existing from the admission date', () => {
  const ctx = (s) => resolveStudentFeeContext(s, YEAR);
  assert.deepEqual(ctx({ admissionDate: '2026-07-28' }), { firstBillableMonth: 7, isNew: true });
  assert.deepEqual(ctx({ admissionDate: '2026-01-01' }), { firstBillableMonth: 1, isNew: true });
  assert.deepEqual(ctx({ admissionDate: '2026-12-31' }), { firstBillableMonth: 12, isNew: true });
  assert.deepEqual(ctx({ admissionDate: '2025-06-10' }), { firstBillableMonth: 1, isNew: false });
  assert.deepEqual(ctx({ admissionDate: '2027-01-02' }), { firstBillableMonth: null, isNew: false });
  assert.deepEqual(ctx({ admissionDate: null }), { firstBillableMonth: 1, isNew: false });
  // Date objects from the driver behave like date strings.
  assert.equal(ctx({ admissionDate: new Date(2026, 8, 15) }).firstBillableMonth, 9);
});

test('context: year without stored dates falls back to the calendar year in its name', () => {
  const year = { id: 'y', name: '2026', startDate: null, endDate: null };
  assert.equal(
    resolveStudentFeeContext({ admissionDate: '2026-04-02' }, year).firstBillableMonth,
    4,
  );
  const unnamed = { id: 'y', name: 'Session A', startDate: null, endDate: null };
  assert.deepEqual(resolveStudentFeeContext({ admissionDate: '2026-04-02' }, unnamed), {
    firstBillableMonth: 1,
    isNew: false,
  });
});

test('context: explicit student type wins, but only for the year it was set for', () => {
  const inYear = '2026-03-01';
  assert.equal(
    resolveStudentFeeContext(
      { admissionDate: inYear, studentType: 'existing', studentTypeAcademicYearId: YEAR.id },
      YEAR,
    ).isNew,
    false,
  );
  assert.equal(
    resolveStudentFeeContext(
      { admissionDate: '2020-03-01', studentType: 'new', studentTypeAcademicYearId: YEAR.id },
      YEAR,
    ).isNew,
    true,
  );
  // Marker belongs to another academic year: ignored, date rule applies.
  assert.equal(
    resolveStudentFeeContext(
      { admissionDate: inYear, studentType: 'existing', studentTypeAcademicYearId: 'other-year' },
      YEAR,
    ).isNew,
    true,
  );
  // The override never changes the billing start month.
  assert.equal(
    resolveStudentFeeContext(
      { admissionDate: '2026-07-10', studentType: 'existing', studentTypeAcademicYearId: YEAR.id },
      YEAR,
    ).firstBillableMonth,
    7,
  );
});

test('headApplies: new/existing/all', () => {
  assert.equal(headApplies(ADMISSION, true), true);
  assert.equal(headApplies(ADMISSION, false), false);
  assert.equal(headApplies(SESSION, true), false);
  assert.equal(headApplies(SESSION, false), true);
  assert.equal(headApplies(TUITION, true), true);
  assert.equal(headApplies({}, false), true);
});

test('student admitted in July: no Jan-Jun dues, July carries tuition + admission fee + term fee', () => {
  const student = { admissionDate: '2026-07-28' };
  for (let m = 1; m <= 6; m++) assert.deepEqual(select(student, m), []);
  // Admission Fee (January head) shows in July as catch-up; no Session Fee.
  assert.deepEqual(names(select(student, 7)), ['Admission Fee', 'Term Fee', 'Tuition']);
  assert.deepEqual(names(select(student, 8)), ['Tuition']);
});

test('the admission day does not matter: whole month is billed', () => {
  for (const day of ['2026-07-01', '2026-07-15', '2026-07-20', '2026-07-31']) {
    const rows = select({ admissionDate: day }, 7);
    const totals = computeFeeTotals(buildBreakdown(rows, [], 'x', 7));
    assert.equal(totals.payableAmount, 1700);
  }
});

test('student admitted in January: normal schedule, admission fee not session fee', () => {
  const student = { admissionDate: '2026-01-10' };
  assert.deepEqual(names(select(student, 1)), ['Admission Fee', 'Tuition']);
  assert.deepEqual(names(select(student, 7)), ['Term Fee', 'Tuition']);
});

test('existing student: session fee in January, never the admission fee', () => {
  const student = { admissionDate: '2024-05-01' };
  assert.deepEqual(names(select(student, 1)), ['Session Fee', 'Tuition']);
  assert.equal(select(student, 1).some((r) => r.feeHead.name === 'Admission Fee'), false);
});

test('half-yearly head: before July no catch-up, after July charged in the joining month', () => {
  // Joins in March: the July charge arrives on schedule.
  assert.deepEqual(names(select({ admissionDate: '2026-03-05' }, 3)), ['Admission Fee', 'Tuition']);
  assert.deepEqual(names(select({ admissionDate: '2026-03-05' }, 7)), ['Term Fee', 'Tuition']);
  // Joins in September: July already passed, full amount in September.
  assert.deepEqual(names(select({ admissionDate: '2026-09-05' }, 9)), ['Admission Fee', 'Term Fee', 'Tuition']);
  assert.deepEqual(names(select({ admissionDate: '2026-09-05' }, 10)), ['Tuition']);
});

test('student admitted after the academic year gets no dues at all', () => {
  const student = { admissionDate: '2027-02-01' };
  for (let m = 1; m <= 12; m++) assert.deepEqual(select(student, m), []);
});

test('without a context the legacy selection is unchanged', () => {
  assert.deepEqual(names(selectStructureRows(STRUCTURE, null, 1)), ['Admission Fee', 'Session Fee', 'Tuition']);
  assert.deepEqual(names(selectStructureRows(STRUCTURE, null, 7)), ['Term Fee', 'Tuition']);
});

// ---------------- reconcile planner ----------------

const fee = (month, overrides = {}) => ({
  id: `fee-${month}`,
  academicYearId: YEAR.id,
  month,
  classId: 'c1',
  sectionId: null,
  status: 'due',
  baseAmount: '1000.00',
  discountAmount: '0.00',
  payableAmount: '1000.00',
  paidAmount: '0.00',
  breakdown: [{ feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 }],
  voidSource: null,
  deleted: false,
  payments: [],
  ...overrides,
});

const plan = (studentOverrides, fees, extra = {}) =>
  planStudentReconcile({
    student: {
      id: 'st1',
      schoolId: 's1',
      classId: 'c1',
      sectionId: null,
      academicYearId: YEAR.id,
      isActive: true,
      admissionDate: '2026-07-10',
      studentType: null,
      studentTypeAcademicYearId: null,
      ...studentOverrides,
    },
    years: [YEAR],
    fees,
    structures: STRUCTURE,
    discounts: [],
    headApplicability: new Map([
      [TUITION.id, 'all'],
      [ADMISSION.id, 'new_students'],
      [SESSION.id, 'existing_students'],
    ]),
    openAdjustments: [],
    latestGeneratedMonth: new Map(),
    createMissing: true,
    ...extra,
  });

const payment = (amount, allocations = []) => ({ amount: String(amount), allocations });

test('planner voids unpaid dues before the admission month and rebuilds the admission month', () => {
  const actions = plan({}, [fee(1), fee(6), fee(7), fee(8)]);
  const voided = actions.filter((a) => a.type === 'void').map((a) => a.month);
  assert.deepEqual(voided, [1, 6]);
  const july = actions.find((a) => a.type === 'rebuild' && a.month === 7);
  assert.ok(july, 'July should be rebuilt with the admission fee catch-up');
  assert.deepEqual(july.breakdown.map((b) => b.feeHeadName).sort(), ['Admission Fee', 'Term Fee', 'Tuition']);
  assert.equal(july.payableAmount, '1700.00');
  // August already matches the rules.
  assert.equal(actions.some((a) => a.month === 8), false);
});

test('planner never touches rows with money: pre-admission payments become review flags', () => {
  const paidJan = fee(1, {
    status: 'paid',
    paidAmount: '1000.00',
    payments: [payment(1000)],
  });
  const partialFeb = fee(2, {
    status: 'partial',
    paidAmount: '400.00',
    payments: [payment(400)],
  });
  const actions = plan({}, [paidJan, partialFeb]);
  assert.equal(actions.some((a) => ['void', 'rebuild', 'reinstate'].includes(a.type)), false);
  const flags = actions.filter((a) => a.type === 'flag');
  assert.deepEqual(flags.map((f) => [f.month, f.kind, f.amount]), [
    [1, 'pre_admission_payment', 1000],
    [2, 'pre_admission_payment', 400],
  ]);
});

test('planner reinstates rows it voided when the admission date moves earlier', () => {
  const voided = fee(3, {
    status: 'cancelled',
    voidSource: 'admission_date',
    breakdown: [],
    baseAmount: '0.00',
    payableAmount: '0.00',
  });
  const stillBefore = plan({ admissionDate: '2026-07-10' }, [voided]);
  assert.equal(stillBefore.length, 0);
  const moved = plan({ admissionDate: '2026-02-10' }, [voided]);
  const back = moved.find((a) => a.type === 'reinstate');
  assert.ok(back);
  assert.equal(back.payableAmount, '1000.00');
  // A row cancelled for any other reason is never auto-reinstated.
  const manual = fee(3, { status: 'cancelled', voidSource: null });
  assert.equal(plan({ admissionDate: '2026-02-10' }, [manual]).length, 0);
});

test('planner creates the months the class already has, from the admission month', () => {
  const actions = plan({}, [], { latestGeneratedMonth: new Map([[YEAR.id, 9]]) });
  const created = actions.filter((a) => a.type === 'create');
  assert.deepEqual(created.map((a) => a.month), [7, 8, 9]);
  assert.equal(created[0].breakdown.length, 3);
  assert.equal(created[1].breakdown.length, 1);
  // Nothing generated yet for the class -> nothing created.
  assert.equal(plan({}, []).some((a) => a.type === 'create'), false);
  // Inactive students or a disabled option never get new rows.
  assert.equal(
    plan({ isActive: false }, [], { latestGeneratedMonth: new Map([[YEAR.id, 9]]) }).length,
    0,
  );
  assert.equal(
    plan({}, [], { latestGeneratedMonth: new Map([[YEAR.id, 9]]), createMissing: false }).length,
    0,
  );
  // Months that already have a row (even voided) are not recreated.
  const withRow = plan({}, [fee(8)], { latestGeneratedMonth: new Map([[YEAR.id, 9]]) });
  assert.deepEqual(withRow.filter((a) => a.type === 'create').map((a) => a.month), [7, 9]);
});

test('planner: existing student drops an unpaid Admission Fee and gains the Session Fee', () => {
  const january = fee(1, {
    breakdown: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
      { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', base: 500, discount: 0, payable: 500 },
    ],
    baseAmount: '1500.00',
    payableAmount: '1500.00',
  });
  const actions = plan({ admissionDate: '2023-02-01' }, [january]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'rebuild');
  assert.deepEqual(actions[0].breakdown.map((b) => b.feeHeadName).sort(), ['Session Fee', 'Tuition']);
  assert.equal(actions[0].payableAmount, '1300.00');
});

test('planner: paid Admission Fee of a student who is not new is flagged, not rewritten', () => {
  const january = fee(1, {
    status: 'partial',
    paidAmount: '500.00',
    breakdown: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
      { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', base: 500, discount: 0, payable: 500 },
    ],
    baseAmount: '1500.00',
    payableAmount: '1500.00',
    payments: [payment(500, [{ feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', amount: 500 }])],
  });
  const actions = plan({ admissionDate: '2023-02-01' }, [january]);
  // The paid Admission Fee stays (money is never undone) and is flagged for Finance;
  // the Session Fee the old student owes is added to the bill.
  assert.deepEqual(actions.map((a) => a.type).sort(), ['adjust_heads', 'flag']);
  const flag = actions.find((a) => a.type === 'flag');
  assert.equal(flag.kind, 'inapplicable_head_payment');
  assert.equal(flag.amount, 500);
  assert.deepEqual(flag.details.nowBilled.map((b) => b.feeHeadName), ['Session Fee']);
  const adjust = actions.find((a) => a.type === 'adjust_heads');
  assert.deepEqual(adjust.added, ['Session Fee']);
  assert.deepEqual(adjust.removed, []);
  assert.deepEqual(adjust.breakdown.map((b) => b.feeHeadName), ['Tuition', 'Admission Fee', 'Session Fee']);
  assert.equal(adjust.payableAmount, '1800.00');
});

test('planner: an unpaid Admission Fee line in a part-paid month of an old student is dropped, Session Fee added', () => {
  const january = fee(1, {
    status: 'partial',
    paidAmount: '400.00',
    breakdown: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
      { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', base: 500, discount: 0, payable: 500 },
    ],
    baseAmount: '1500.00',
    payableAmount: '1500.00',
    payments: [payment(400, [{ feeHeadId: TUITION.id, feeHeadName: 'Tuition', amount: 400 }])],
  });
  const actions = plan({ admissionDate: '2023-02-01' }, [january]);
  assert.deepEqual(actions.map((a) => a.type), ['adjust_heads']); // nothing paid on it -> no review item
  assert.deepEqual(actions[0].breakdown.map((b) => b.feeHeadName), ['Tuition', 'Session Fee']);
  assert.deepEqual(actions[0].removed, ['Admission Fee']);
  assert.equal(actions[0].payableAmount, '1300.00');
});

test('planner: a late joiner who already paid the admission month gets the January-only heads billed', () => {
  const july = fee(7, {
    status: 'paid',
    paidAmount: '1000.00',
    payments: [payment(1000, [{ feeHeadId: TUITION.id, feeHeadName: 'Tuition', amount: 1000 }])],
  });
  const actions = plan({ admissionDate: '2026-07-10' }, [july]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'adjust_heads');
  assert.deepEqual(actions[0].added.sort(), ['Admission Fee', 'Term Fee']);
  assert.equal(actions[0].payableAmount, '1700.00');
});

test('planner: adjusting a paid month is idempotent', () => {
  const adjusted = fee(1, {
    status: 'partial',
    paidAmount: '500.00',
    breakdown: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
      { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', base: 500, discount: 0, payable: 500 },
      { feeHeadId: SESSION.id, feeHeadName: 'Session Fee', base: 300, discount: 0, payable: 300 },
    ],
    baseAmount: '1800.00',
    payableAmount: '1800.00',
    payments: [payment(500, [{ feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', amount: 500 }])],
  });
  const open = [{ id: 'adj-1', studentFeeId: adjusted.id, kind: 'inapplicable_head_payment' }];
  assert.deepEqual(plan({ admissionDate: '2023-02-01' }, [adjusted], { openAdjustments: open }), []);
});


test('planner: an explicit "existing" marker overrides an in-year admission date', () => {
  const january = fee(7, {
    breakdown: [
      { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
    ],
  });
  const actions = plan(
    { admissionDate: '2026-07-10', studentType: 'existing', studentTypeAcademicYearId: YEAR.id },
    [january],
  );
  const rebuilt = actions.find((a) => a.type === 'rebuild');
  // Session Fee (existing) + tuition + term fee; no Admission Fee.
  assert.deepEqual(rebuilt.breakdown.map((b) => b.feeHeadName).sort(), ['Session Fee', 'Term Fee', 'Tuition']);
});

test('planner is idempotent: applying the plan leaves nothing further to do', () => {
  const correct = [
    fee(7, {
      breakdown: [
        { feeHeadId: TUITION.id, feeHeadName: 'Tuition', base: 1000, discount: 0, payable: 1000 },
        { feeHeadId: ADMISSION.id, feeHeadName: 'Admission Fee', base: 500, discount: 0, payable: 500 },
        { feeHeadId: HALF.id, feeHeadName: 'Term Fee', base: 200, discount: 0, payable: 200 },
      ],
      baseAmount: '1700.00',
      payableAmount: '1700.00',
    }),
    fee(1, { status: 'cancelled', voidSource: 'admission_date', breakdown: [], payableAmount: '0.00', baseAmount: '0.00' }),
  ];
  assert.deepEqual(plan({}, correct), []);
});

test('planner dismisses a review flag once its cause is gone', () => {
  const paidJan = fee(1, { status: 'paid', paidAmount: '1000.00', payments: [payment(1000)] });
  const open = [{ id: 'adj-1', studentFeeId: paidJan.id, kind: 'pre_admission_payment' }];
  // Still admitted in July: flag stays, nothing new is raised.
  assert.deepEqual(plan({}, [paidJan], { openAdjustments: open }), []);
  // Admission date corrected to January: the flag is dismissed.
  const actions = plan({ admissionDate: '2026-01-05' }, [paidJan], { openAdjustments: open });
  assert.equal(actions.some((a) => a.type === 'dismiss_flag' && a.adjustmentId === 'adj-1'), true);
});

test('planner ignores soft-deleted rows', () => {
  const deleted = fee(1, { deleted: true });
  assert.equal(plan({}, [deleted]).some((a) => a.feeId === deleted.id), false);
});

test('January-only heads are charged in the admission month even when their schedule says monthly', () => {
  // As configured on production: every head is "monthly", annual amounts sit under January only.
  const ADM = head('m-adm', 'Admission Fee', 'monthly', 'new_students');
  const SES = head('m-ses', 'Session Fee', 'monthly', 'existing_students');
  const ANNUAL = head('m-ann', 'Annual Fund', 'monthly');
  const EXAM = head('m-exam', 'Exam Fee', 'monthly'); // recurring: March and June
  const structure = [
    ...Array.from({ length: 12 }, (_, i) => row(TUITION, i + 1, 1000)),
    row(ADM, 1, 500),
    row(SES, 1, 300),
    row(ANNUAL, 1, 100),
    row(EXAM, 3, 50),
    row(EXAM, 6, 50),
  ];
  const pick = (student, month) =>
    names(selectStructureRows(structure, resolveStudentFeeContext(student, YEAR), month));

  // Admitted in July: nothing before; July carries every January-only head for a new student.
  assert.deepEqual(pick({ admissionDate: '2026-07-15' }, 3), []);
  assert.deepEqual(pick({ admissionDate: '2026-07-15' }, 7), ['Admission Fee', 'Annual Fund', 'Tuition']);
  // Following months are plain tuition; Exam Fee is not caught up because it recurs.
  assert.deepEqual(pick({ admissionDate: '2026-07-15' }, 8), ['Tuition']);
  // Admitted in February: Jan-only heads arrive in February, exam fees on schedule in March.
  assert.deepEqual(pick({ admissionDate: '2026-02-03' }, 2), ['Admission Fee', 'Annual Fund', 'Tuition']);
  assert.deepEqual(pick({ admissionDate: '2026-02-03' }, 3), ['Exam Fee', 'Tuition']);
  // An old student admitted mid-year (explicit marker) gets the Session Fee instead of the Admission Fee.
  assert.deepEqual(
    pick({ admissionDate: '2026-07-15', studentType: 'existing', studentTypeAcademicYearId: YEAR.id }, 7),
    ['Annual Fund', 'Session Fee', 'Tuition'],
  );
  // Existing students and January admissions are unaffected.
  assert.deepEqual(pick({ admissionDate: '2024-03-01' }, 1), ['Annual Fund', 'Session Fee', 'Tuition']);
  assert.deepEqual(pick({ admissionDate: '2026-01-20' }, 1), ['Admission Fee', 'Annual Fund', 'Tuition']);
});

test('a head that gains a second month is recurring, no longer a one-time catch-up', () => {
  const FUND = head('m-fund', 'Fund', 'monthly');
  const structure = [row(TUITION, 5, 1000), row(FUND, 1, 100), row(FUND, 5, 100)];
  const pick = (m) => names(selectStructureRows(structure, resolveStudentFeeContext({ admissionDate: '2026-05-02' }, YEAR), m));
  assert.deepEqual(pick(5), ['Fund', 'Tuition']); // billed because month 5 has its own row, once
});

test('planner leaves closed academic years untouched', () => {
  const closed = { ...YEAR, status: 'closed' };
  const actions = planStudentReconcile({
    student: {
      id: 'st1', schoolId: 's1', classId: 'c1', sectionId: null, academicYearId: YEAR.id,
      isActive: true, admissionDate: '2026-07-10', studentType: null, studentTypeAcademicYearId: null,
    },
    years: [closed],
    fees: [fee(1), fee(7)],
    structures: STRUCTURE,
    discounts: [],
    headApplicability: new Map(),
    openAdjustments: [{ id: 'adj-1', studentFeeId: 'fee-1', kind: 'pre_admission_payment' }],
    latestGeneratedMonth: new Map([[YEAR.id, 12]]),
    createMissing: true,
  });
  assert.deepEqual(actions, []);
});

test('planner does not adjust a paid month whose lines do not add up to its payable amount', () => {
  const odd = fee(1, {
    status: 'partial',
    paidAmount: '400.00',
    payableAmount: '1500.00', // lines only sum to 1000
    payments: [payment(400, [{ feeHeadId: TUITION.id, feeHeadName: 'Tuition', amount: 400 }])],
  });
  const actions = plan({ admissionDate: '2023-02-01' }, [odd]);
  assert.equal(actions.some((a) => a.type === 'adjust_heads'), false);
});
