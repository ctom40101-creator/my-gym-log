// V2026.10-05.1: S1 bounded Owner policy omission; actual callback/cleanup identity and listener regression.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authHarness, deferred, flushAsync, syntheticOwner } from './responsiveness-harness.mjs';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const claimsFor = (user, provider = 'google.com') => ({ email: user.email, email_verified: true, sub: user.uid, firebase: { sign_in_provider: provider } });
const member = (provider = 'google.com') => ({ uid: 'synthetic-member', email: 'member@example.invalid', providerData: [{ providerId: provider }] });
const policyFor = user => ({ program: 'LEGACY_ACCOUNT_SUNSET_2026', cohort: 'LEGACY_MIGRATION_KEEP_01', originalUid: user.uid, deadlineAt: '2026-12-31T15:59:59Z', state: 'LEGACY_PASSWORD_PENDING', deletionHold: false });
const rejected = () => ({ then(_yes, no) { no(new Error('synthetic-read-failure')); } });

test('canonical Owner waits for token verification before any policy or Owner read', async () => {
  const token = deferred(), h = authHarness(source, { token: token.promise }); const running = h.run();
  await flushAsync(); assert.deepEqual(h.calls, ['token']); assert.ok(!h.access.includes('admin'));
  token.resolve({ claims: claimsFor(h.user) }); await running; assert.equal(h.access.at(-1), 'admin');
});
for (const kind of ['unverified', 'password', 'claim-email-mismatch', 'user-email-mismatch']) {
  test(`${kind} identity retains policy resolution and the existing claim/UID decision`, async () => {
    const user = syntheticOwner(); const claims = claimsFor(user);
    if (kind === 'unverified') claims.email_verified = false;
    if (kind === 'password') { claims.firebase.sign_in_provider = 'password'; user.providerData = [{ providerId: 'password' }]; }
    if (kind === 'claim-email-mismatch') claims.email = 'member@example.invalid';
    if (kind === 'user-email-mismatch') user.email = 'member@example.invalid';
    const policy = deferred(), h = authHarness(source, { user, claims, policy: policy.promise }); const running = h.run();
    await flushAsync(); assert.ok(h.calls.includes('policy')); assert.ok(!h.access.includes('admin'));
    policy.resolve(null); await running;
    if (kind === 'claim-email-mismatch') {
      assert.ok(h.calls.includes('request-listener')); assert.ok(!h.calls.includes('owner'));
      h.receiveRequest({ status: 'pending' }); assert.equal(h.access.at(-1), 'pending'); assert.ok(!h.access.includes('admin'));
    } else if (kind === 'user-email-mismatch') {
      assert.ok(h.calls.includes('owner')); assert.equal(h.access.at(-1), 'admin');
    } else assert.equal(h.access.at(-1), 'identity_invalid');
  });
}
test('absent Production Owner config never bootstraps or grants access', async () => {
  const h = authHarness(source, { ownerUid: null }); await h.run();
  assert.equal(h.access.at(-1), 'identity_invalid'); assert.ok(!h.calls.includes('bootstrap'));
});
for (const wrongBootstrap of [false, true]) {
  test(`existing STAGING bootstrap retains exact identity check, mismatch=${wrongBootstrap}`, async () => {
    const h = authHarness(source, { ownerUid: null, appEnvironment: 'staging', bootstrapUid: wrongBootstrap ? 'different-synthetic-owner' : undefined }); await h.run();
    assert.ok(h.calls.includes('bootstrap')); assert.equal(h.access.at(-1), wrongBootstrap ? 'identity_invalid' : 'admin');
  });
}
test('non-Owner policy read error still reaches the existing request listener', async () => {
  const h = authHarness(source, { user: member(), policy: rejected() }); await h.run();
  assert.ok(h.calls.includes('policy')); assert.ok(h.calls.includes('request-listener')); assert.ok(!h.calls.includes('owner'));
  h.failRequest(); assert.equal(h.access.at(-1), 'error');
});
for (const expired of [false, true]) {
  test(`password legacy migration policy and product-access decision are preserved, expired=${expired}`, async () => {
    const user = member('password'), policy = { ...policyFor(user), ...(expired ? { state: 'DELETION_ELIGIBLE' } : {}) };
    const h = authHarness(source, { user, claims: claimsFor(user, 'password'), policy }); await h.run();
    assert.deepEqual(h.migrationPolicies.at(-1), policy); assert.equal(h.access.at(-1), expired ? 'legacy_expired' : 'legacy');
    assert.ok(!h.calls.includes('owner')); assert.ok(!h.calls.includes('request-listener'));
  });
}
test('Google legacy target retains migration notice and live request decisions', async () => {
  const user = member(), policy = policyFor(user), h = authHarness(source, { user, policy }); await h.run();
  assert.deepEqual(h.migrationPolicies.at(-1), policy);
  for (const status of ['pending', 'rejected', 'disabled', 'approved']) { h.receiveRequest({ status }); assert.equal(h.access.at(-1), status); }
  h.receiveRequest({ status: 'denied' }); assert.equal(h.access.at(-1), 'identity_invalid');
  h.receiveRequest({ status: 'approved', selfDeleteRequestedAt: 'synthetic-marker' }); assert.equal(h.selfDeleteRequested.at(-1), true);
});
test('identity change during pending token does not start policy or Owner lookup', async () => {
  const token = deferred(), h = authHarness(source, { token: token.promise }); const running = h.run();
  h.context.auth.currentUser = member(); token.resolve({ claims: claimsFor(h.user) }); await running;
  assert.deepEqual(h.calls, ['token']); assert.ok(!h.access.includes('admin'));
});
test('identity change during pending Owner lookup prevents late access grant', async () => {
  const owner = deferred(), h = authHarness(source, { ownerUid: owner.promise }); const running = h.run();
  await flushAsync(); assert.ok(h.calls.includes('owner')); h.context.auth.currentUser = member(); owner.resolve(h.user.uid); await running;
  assert.ok(!h.access.includes('admin')); assert.ok(!h.calls.includes('request-listener'));
});
test('logout during member policy read does not install a request listener', async () => {
  const policy = deferred(), h = authHarness(source, { user: member(), policy: policy.promise }); const running = h.run();
  await flushAsync(); h.context.auth.currentUser = null; policy.resolve(null); await running;
  assert.ok(!h.calls.includes('request-listener')); assert.ok(!h.access.includes('approved'));
});
test('actual observer cleanup during Owner lookup prevents late access grant', async () => {
  const owner = deferred(), h = authHarness(source, { ownerUid: owner.promise }); const running = h.run();
  await flushAsync(); h.stop(); owner.resolve(h.user.uid); await running;
  assert.ok(h.calls.includes('auth-unsubscribe')); assert.ok(!h.access.includes('admin'));
});
test('actual observer cleanup removes request listener and ignores late callbacks/errors', async () => {
  const h = authHarness(source, { user: member() }); await h.run(); h.stop(); const access = [...h.access];
  assert.ok(h.calls.includes('request-unsubscribe')); assert.ok(h.calls.includes('auth-unsubscribe'));
  h.receiveRequest({ status: 'approved' }); h.failRequest(); assert.deepEqual(h.access, access);
});
test('actual observer cleanup while token is pending prevents further reads', async () => {
  const token = deferred(), h = authHarness(source, { token: token.promise }); const running = h.run(); h.stop();
  token.resolve({ claims: claimsFor(h.user) }); await running;
  assert.deepEqual(h.calls, ['token', 'auth-unsubscribe']); assert.ok(!h.access.includes('admin'));
});
