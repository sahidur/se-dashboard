require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthController } = require('./auth.controller');

const tokens = { accessToken: 'access-secret', refreshToken: 'refresh-secret' };
const user = { id: 'user-1', email: 'person@example.org' };

function response() {
  const cookies = [];
  return {
    cookies,
    cookie(name, value, options) { cookies.push({ name, value, options }); },
  };
}

function assertSession(res, body, expectedBody) {
  assert.deepEqual(body, expectedBody);
  assert.deepEqual(res.cookies.map(({ name, value }) => [name, value]), [
    ['se360_at', tokens.accessToken], ['se360_rt', tokens.refreshToken],
  ]);
  assert.ok(res.cookies.every(({ options }) => options.httpOnly));
  assert.equal(res.cookies[1].options.path, '/api/auth');
  assert.ok(!JSON.stringify(body).includes('secret'));
}

test('login and passkey verification set cookies without exposing credentials', async () => {
  const controller = new AuthController(
    { login: async () => ({ user, ...tokens }) },
    { verifyAuthentication: async () => ({ user, ...tokens }) },
  );
  const loginRes = response();
  assertSession(loginRes, await controller.login({ email: user.email, password: 'pw' }, loginRes), { user });
  const passkeyRes = response();
  assertSession(passkeyRes, await controller.passkeyLoginVerify({ flowId: 'flow', response: {} }, passkeyRes), { user });
});

test('refresh requires the cookie and rotates it without returning tokens', async () => {
  let presented;
  const controller = new AuthController({
    refreshTokens: async (token) => { presented = token; return tokens; },
  }, {});
  const res = response();
  assertSession(res, await controller.refreshTokens({ cookies: { se360_rt: 'old-secret' } }, res), {
    message: 'Session refreshed',
  });
  assert.equal(presented, 'old-secret');
  await assert.rejects(controller.refreshTokens({ cookies: {}, body: { refreshToken: 'body-secret' } }, response()), {
    message: 'Refresh token is required',
  });
});

test('password change retains the new cookies but returns only a message', async () => {
  const controller = new AuthController({
    changePassword: async () => ({ message: 'Password changed successfully', ...tokens }),
  }, {});
  const res = response();
  assertSession(res, await controller.changePassword(user.id, {
    currentPassword: 'old', newPassword: 'new',
  }, res), { message: 'Password changed successfully' });
});
