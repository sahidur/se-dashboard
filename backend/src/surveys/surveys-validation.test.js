require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { CreateSurveyCategoryDto } = require('./dto/create-survey-category.dto');
const { BulkSurveyAssignmentsDto } = require('./dto/bulk-assignments.dto');
const { CreateSurveyAssignmentDto } = require('./dto/create-survey.dto');

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

// Mirrors the global ValidationPipe in main.ts.
const pipeOpts = { whitelist: true, forbidNonWhitelisted: true };

test('category creation body is validated and whitelisted', () => {
  const ok = validateSync(
    plainToInstance(CreateSurveyCategoryDto, {
      name: 'Education', description: 'd', sortOrder: 3, isActive: true,
    }),
    pipeOpts,
  );
  assert.deepEqual(ok, []);

  for (const input of [
    { name: 'x'.repeat(101) },
    { name: 'n', sortOrder: 'not-a-number' },
    { name: 'n', injected: true },
    { description: 'no-name' },
    { name: '' },
  ]) {
    assert.notEqual(
      validateSync(plainToInstance(CreateSurveyCategoryDto, input), pipeOpts).length,
      0,
      JSON.stringify(input),
    );
  }
});

test('bulk assignment bodies are nested-validated per assignment', () => {
  const ok = validateSync(
    plainToInstance(BulkSurveyAssignmentsDto, {
      assignments: [{ userId: a }, { roleId: b, excludeUserIds: [a] }],
    }),
    pipeOpts,
  );
  assert.deepEqual(ok, []);

  for (const input of [
    { assignments: [{ userId: 'not-a-uuid' }] },
    { assignments: [{ injected: true }] },
    { assignments: [{ excludeUserIds: ['nope'] }] },
    { assignments: 'nope' },
    {},
  ]) {
    assert.notEqual(
      validateSync(plainToInstance(BulkSurveyAssignmentsDto, input), pipeOpts).length,
      0,
      JSON.stringify(input),
    );
  }
});

test('single assignment DTO rejects unexpected fields too', () => {
  assert.notEqual(
    validateSync(plainToInstance(CreateSurveyAssignmentDto, { userId: a, extra: 1 }), pipeOpts).length,
    0,
  );
});
