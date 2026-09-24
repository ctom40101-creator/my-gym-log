import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { exportPKCS8, SignJWT } from 'jose';
import { createWorker, verifyFirebaseToken } from '../worker/src/index.js';

const projectId = 'mygymlog-604bc';
const ownerEmail = 'ctom40101@gmail.com';
const origin = 'https://my-gym-log.onrender.com';
let privateKey;
let publicKey;
let serviceAccount;

before(async () => {
  ({ privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 }));
  serviceAccount = JSON.stringify({
    type: 'service_account', project_id: projectId,
    client_email: 'test-service-account@example.test',
    private_key: await exportPKCS8(privateKey),
  });
});

async function idToken({ uid = 'owner-uid', email = ownerEmail, verified = true, audience = projectId, expiration = '1h', issuedAt } = {}) {
  return new SignJWT({ email, email_verified: verified, auth_time: Math.floor(Date.now() / 1000) - 30 })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(audience)
    .setSubject(uid)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiration)
    .sign(privateKey);
}

function fixture({ ownerUsers, targetUsers, googleError } = {}) {
  const calls = [];
  const lookupOwner = ownerUsers ?? [{ localId: 'owner-uid', email: ownerEmail, emailVerified: true }];
  const lookupTarget = targetUsers ?? [{ localId: 'member-uid', email: 'member@example.test', disabled: false }];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      calls.push({ url, method: init.method, body: Object.fromEntries(new URLSearchParams(init.body)) });
      return Response.json({ access_token: 'fake-access-token', expires_in: 3600 });
    }
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ url, method: init.method, body });
    if (url.endsWith('/accounts:lookup')) {
      return Response.json({ users: body.email ? lookupOwner : lookupTarget });
    }
    if (googleError) return Response.json({ error: { message: googleError } }, { status: 400 });
    if (url.endsWith('/accounts:update')) return Response.json({ localId: body.localId });
    if (url.endsWith('/accounts:delete')) return Response.json({ kind: 'identitytoolkit#DeleteAccountResponse' });
    throw new Error(`Unexpected request: ${url}`);
  };
  const worker = createWorker({ fetchImpl, resolveKey: async () => publicKey });
  const env = { SERVICE_ACCOUNT_JSON: serviceAccount, FIREBASE_PROJECT_ID: projectId, FRONTEND_ORIGIN: origin };
  return { worker, env, calls };
}

async function call(worker, env, path, token, body = {}) {
  return worker.fetch(new Request(`https://worker.example.test${path}`, {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
}

test('Firebase verifier checks signature, issuer, audience, expiry and subject', async () => {
  const token = await idToken();
  assert.equal((await verifyFirebaseToken(token, projectId, { resolveKey: async () => publicKey })).sub, 'owner-uid');
  await assert.rejects(verifyFirebaseToken(await idToken({ audience: 'wrong-project' }), projectId, { resolveKey: async () => publicKey }));
  await assert.rejects(verifyFirebaseToken(await idToken({ expiration: '-1h' }), projectId, { resolveKey: async () => publicKey }));
  await assert.rejects(verifyFirebaseToken(await idToken({ issuedAt: Math.floor(Date.now() / 1000) + 3600 }), projectId, { resolveKey: async () => publicKey }));
  await assert.rejects(verifyFirebaseToken(token, projectId, { resolveKey: async () => generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey }));
});

test('unverified or non-owner Firebase token never reaches privileged Google API', async () => {
  for (const claims of [{ verified: false }, { email: 'other@example.test' }]) {
    const f = fixture();
    const response = await call(f.worker, f.env, '/admin/users/member-uid/disable', await idToken(claims));
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 0);
  }
});

test('missing bearer and wrong origin are rejected without privileged calls', async () => {
  const f = fixture();
  const response = await f.worker.fetch(new Request('https://worker.example.test/admin/users/member-uid/disable', { method: 'POST' }), f.env);
  assert.equal(response.status, 401);
  assert.equal(f.calls.length, 0);
  const badOrigin = await f.worker.fetch(new Request('https://worker.example.test/admin/users/member-uid/disable', {
    method: 'POST', headers: { Origin: 'https://attacker.example.test', Authorization: `Bearer ${await idToken()}` },
  }), f.env);
  assert.equal(badOrigin.status, 403);
  assert.equal(f.calls.length, 0);
});

test('owner email collision or UID mismatch causes safe stop before target mutation', async () => {
  for (const ownerUsers of [
    [{ localId: 'owner-uid', email: ownerEmail }, { localId: 'shadow-uid', email: ownerEmail }],
    [{ localId: 'shadow-uid', email: ownerEmail }],
  ]) {
    const f = fixture({ ownerUsers });
    const response = await call(f.worker, f.env, '/admin/users/member-uid/disable', await idToken());
    assert.equal(response.status, 409);
    assert.equal(f.calls.filter(item => item.url.endsWith('/accounts:update')).length, 0);
  }
});

test('disable uses target UID and blocks owner target or mismatched lookup', async () => {
  const f = fixture();
  const response = await call(f.worker, f.env, '/admin/users/member-uid/disable', await idToken());
  assert.equal(response.status, 200);
  assert.equal(f.calls.find(item => item.url.endsWith('/accounts:update')).body.localId, 'member-uid');
  assert.equal(f.calls.find(item => item.url.endsWith('/accounts:update')).body.disableUser, true);

  const self = fixture();
  assert.equal((await call(self.worker, self.env, '/admin/users/owner-uid/disable', await idToken())).status, 409);
  assert.equal(self.calls.filter(item => item.url.endsWith('/accounts:update')).length, 0);

  const mismatch = fixture({ targetUsers: [{ localId: 'another-uid', email: 'member@example.test' }] });
  assert.equal((await call(mismatch.worker, mismatch.env, '/admin/users/member-uid/disable', await idToken())).status, 409);
});

test('delete requires disabled target and explicit cleanup confirmation', async () => {
  const active = fixture();
  assert.equal((await call(active.worker, active.env, '/admin/users/member-uid/delete', await idToken(), { cleanupComplete: true })).status, 409);
  assert.equal(active.calls.filter(item => item.url.endsWith('/accounts:delete')).length, 0);

  const disabled = fixture({ targetUsers: [{ localId: 'member-uid', email: 'member@example.test', disabled: true }] });
  assert.equal((await call(disabled.worker, disabled.env, '/admin/users/member-uid/delete', await idToken())).status, 400);
  assert.equal((await call(disabled.worker, disabled.env, '/admin/users/member-uid/delete', await idToken(), { cleanupComplete: true })).status, 200);
  assert.equal(disabled.calls.filter(item => item.url.endsWith('/accounts:delete')).length, 1);
});

test('target with owner email is protected even when UID differs', async () => {
  const f = fixture({ targetUsers: [{ localId: 'member-uid', email: ownerEmail, disabled: true }] });
  assert.equal((await call(f.worker, f.env, '/admin/users/member-uid/delete', await idToken(), { cleanupComplete: true })).status, 409);
  assert.equal(f.calls.filter(item => item.url.endsWith('/accounts:delete')).length, 0);
});

test('retry after Auth deletion still permits cleanup of an orphaned disabled request', async () => {
  const f = fixture({ targetUsers: [] });
  assert.equal((await call(f.worker, f.env, '/admin/users/member-uid/disable', await idToken())).status, 200);
  assert.equal((await call(f.worker, f.env, '/admin/users/member-uid/delete', await idToken(), { cleanupComplete: true })).status, 200);
});

test('upstream errors are bounded and do not reveal credentials', async () => {
  const f = fixture({ googleError: 'FAKE_PRIVILEGED_DETAIL' });
  const response = await call(f.worker, f.env, '/admin/users/member-uid/disable', await idToken());
  assert.equal(response.status, 502);
  const message = await response.text();
  assert.doesNotMatch(message, /FAKE_PRIVILEGED_DETAIL|fake-access-token|private_key/i);
});
