import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAuthConfig, createAstroAuth, sessionResponse, proxyResponse, callbackResponse } from '../../src/server/auth-adapter.mjs';

const config = { NEON_AUTH_BASE_URL: 'https://test-auth.example/neondb/auth', NEON_AUTH_COOKIE_SECRET: 'x'.repeat(40) };
function context(path = '/api/session', headers = {}, method = 'GET') {
  const url = new URL(path, 'https://bingo.example');
  return { request: new Request(url, { method, headers }), url, params: { path: path.replace('/api/auth/', '') }, cookies: { set() {} } };
}

test('missing or invalid auth configuration never grants identity', async () => {
  assert.equal(readAuthConfig({}), null);
  assert.throws(() => readAuthConfig({ ...config, NEON_AUTH_BASE_URL: 'http://insecure.example' }));
  assert.throws(() => readAuthConfig({ ...config, NEON_AUTH_COOKIE_SECRET: 'short' }));
  const r = await sessionResponse(context(), {});
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await r.json(), { error: 'auth_not_configured' });
});

test('Astro adapter constructs the actual generic Neon server SDK without Next.js', () => {
  const auth = createAstroAuth(context(), readAuthConfig(config));
  assert.equal(typeof auth.getSession, 'function');
});

test('auth proxy rejects unknown routes, methods, and cross-origin mutations', async () => {
  assert.equal((await proxyResponse(context('/api/auth/sign-up/email'), config)).status, 404);
  assert.equal((await proxyResponse(context('/api/auth/sign-out'), config)).status, 405);
  assert.equal((await proxyResponse(context('/api/auth/sign-out', { origin: 'https://attacker.example' }, 'POST'), config)).status, 403);
  assert.equal((await proxyResponse(context('/api/auth/sign-out', {}, 'POST'), config)).status, 403);
});

test('official server SDK validates a test upstream session and only returns a user ID', async t => {
  const expires = new Date(Date.now() + 60_000).toISOString();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ session: { id: 'session-test', userId: 'user-test', token: 'not-for-client', expiresAt: expires },
      user: { id: 'user-test', name: 'Test', email: 'test@example.invalid' } }), { headers: { 'Content-Type': 'application/json' } });
  });
  const r = await sessionResponse(context('/api/session', { cookie: '__Secure-neon-auth.session_token=test-only' }), config);
  assert.equal(r.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(await r.json(), { authenticated: true, userId: 'user-test' });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
});

test('missing and unavailable upstream sessions fail closed without raw errors', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('null', { headers: { 'Content-Type': 'application/json' } }));
  const r = await sessionResponse(context('/api/session', { cookie: '__Secure-neon-auth.session_token=test-only' }), config);
  assert.equal(r.status, 401);
});

test('upstream auth failure never leaks raw error details or grants a session', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('secret-upstream-details'); });
  const r = await sessionResponse(context('/api/session', { cookie: '__Secure-neon-auth.session_token=test-only' }), config);
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await r.json(), { error: 'auth_unavailable' });
});

test('session identity comes from server validation rather than a forged user header', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('null', { headers: { 'Content-Type': 'application/json' } }));
  const r = await sessionResponse(context('/api/session', { 'x-user-id': 'host', cookie: '__Secure-neon-auth.session_token=test-only' }), config);
  assert.equal(r.status, 401);
});


test('callback without a valid session fails closed and ignores redirect query inputs', async () => {
  const r = await callbackResponse(context('/auth/callback?next=https://attacker.example&secret=not-forwarded'), config);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/?auth=failed');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

test('callback accepts a server-validated session and redirects to a fixed public page', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    session: { id: 'session-test', userId: 'user-test', token: 'private', expiresAt: new Date(Date.now()+60_000).toISOString() },
    user: { id: 'user-test' },
  }), { headers: { 'Content-Type': 'application/json' } }));
  const r = await callbackResponse(context('/auth/callback', { cookie: '__Secure-neon-auth.session_token=test-only' }), config);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/');
});

test('OAuth verifier exchange forwards session cookies and drops verifier from redirect', async t => {
  const now = new Date().toISOString();
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    session: { id: 'session-test', userId: 'user-test', token: 'test-only', createdAt: now, updatedAt: now, expiresAt: new Date(Date.now()+60_000).toISOString() },
    user: { id: 'user-test', name: 'Test', email: 'test@example.invalid', emailVerified: true, createdAt: now, updatedAt: now },
  }), { headers: { 'Content-Type': 'application/json',
    'Set-Cookie': '__Secure-neon-auth.session_token=test-only; Path=/; HttpOnly; Secure; SameSite=Lax' } }));
  const r = await callbackResponse(context('/auth/callback?neon_auth_session_verifier=test-verifier&next=https://attacker.example', {
    cookie: '__Secure-neon-auth.session_challenge=test-challenge',
  }), config);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/auth/callback');
  assert.ok(r.headers.getSetCookie().some(cookie => cookie.startsWith('__Secure-neon-auth.session_token=')));
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
});
