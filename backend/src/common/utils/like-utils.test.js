require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeLike, likeContains } = require('./like-utils');

test('LIKE metacharacters are escaped so search input matches literally', () => {
  assert.equal(escapeLike('100%'), '100\\%');
  assert.equal(escapeLike('a_b'), 'a\\_b');
  assert.equal(escapeLike('back\\slash'), 'back\\\\slash');
  assert.equal(escapeLike('%_\\'), '\\%\\_\\\\');
  assert.equal(escapeLike('plain'), 'plain');
});

test('likeContains wraps an escaped term in a contains-pattern', () => {
  assert.equal(likeContains('sch%'), '%sch\\%%');
  assert.equal(likeContains('x'), '%x%');
});
