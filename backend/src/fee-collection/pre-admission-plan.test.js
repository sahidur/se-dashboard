const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePlan } = require('./pre-admission-plan.ts');

test('plan: parses cancel, move and move-to-head lines, ignoring header, blanks and comments', () => {
  const items = parsePlan([
    'receipt_number,action,target_month',
    '# approved 28 Oct',
    '',
    'RCPT-2026-000204,CANCEL',
    'RCPT-2026-003604,move,3',
    'RCPT-2026-008288,MOVE,4,Diary, Badge, ID card , Syllabus, Tie fee',
  ].join('\n'));
  assert.deepEqual(items.map((i) => [i.receiptNumber, i.action, i.targetMonth, i.reallocateHead]), [
    ['RCPT-2026-000204', 'CANCEL', undefined, undefined],
    ['RCPT-2026-003604', 'MOVE', 3, undefined],
    ['RCPT-2026-008288', 'MOVE', 4, 'Diary, Badge, ID card , Syllabus, Tie fee'],
  ]);
});

test('plan: anything unclear is rejected instead of guessed', () => {
  assert.throws(() => parsePlan('RCPT-2026-1,CANCEL'), /not a receipt number/);
  assert.throws(() => parsePlan('RCPT-2026-000001,DELETE'), /CANCEL or MOVE/);
  assert.throws(() => parsePlan('RCPT-2026-000001,MOVE'), /target month/);
  assert.throws(() => parsePlan('RCPT-2026-000001,MOVE,13'), /target month/);
  assert.throws(() => parsePlan('RCPT-2026-000001,CANCEL,3'), /must not have a target month/);
  assert.throws(() => parsePlan('RCPT-2026-000001,CANCEL,,Sports Fee'), /only MOVE/);
  assert.throws(() => parsePlan('RCPT-2026-000001,CANCEL\nRCPT-2026-000001,CANCEL'), /twice/);
  assert.throws(() => parsePlan('# nothing here\n'), /no payments/);
});
