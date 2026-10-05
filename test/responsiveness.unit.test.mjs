// V2026.10-05.1: actual callback wait/security and submission-confirmation regression.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authHarness, deferred, flushAsync, submitHarness } from './responsiveness-harness.mjs';
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('verified canonical Owner reaches UID verification without waiting for an irrelevant legacy policy', async () => {
  const policy = deferred(); const owner = deferred();
  const h = authHarness(source, { policy: policy.promise, ownerUid: owner.promise });
  const running = h.run();
  try { await flushAsync(); assert.ok(h.calls.includes('owner')); assert.ok(!h.access.includes('admin')); owner.resolve(h.user.uid); await running; assert.equal(h.access.at(-1), 'admin'); assert.ok(!h.calls.includes('policy')); }
  finally { policy.resolve(null); owner.resolve(h.user.uid); await running; }
});
test('canonical Owner still waits for exact SecurityConfig UID and rejects a mismatch', async () => {
  const owner = deferred(); const h = authHarness(source, { ownerUid: owner.promise }); const running = h.run();
  await flushAsync(); assert.ok(!h.access.includes('admin')); owner.resolve('different-owner-uid'); await running;
  assert.equal(h.access.at(-1), 'identity_invalid'); assert.ok(!h.calls.includes('bootstrap'));
});
test('non-owner still resolves legacy policy before starting access-request observation', async () => {
  const policy = deferred(); const h = authHarness(source, { user: { uid: 'synthetic-member', email: 'member@example.invalid' }, policy: policy.promise }); const running = h.run();
  await flushAsync(); assert.ok(!h.calls.includes('request-listener')); policy.resolve(null); await running;
  assert.ok(h.calls.includes('policy')); h.receiveRequest({ status: 'approved' }); assert.equal(h.access.at(-1), 'approved');
});
test('Owner token failure fails closed and never reaches owner lookup', async () => {
  const token = deferred(); const h = authHarness(source, { token: token.promise }); const running = h.run(); token.reject(new Error('synthetic-token-error')); await running;
  assert.equal(h.access.at(-1), 'error'); assert.ok(!h.calls.includes('owner'));
});
test('Owner UID read failure retains the authorization error state', async () => {
  const owner = deferred(); const h = authHarness(source, { ownerUid: owner.promise }); const running = h.run(); await flushAsync(); owner.reject(new Error('synthetic-owner-read-error')); await running;
  assert.equal(h.access.at(-1), 'error'); assert.ok(!h.access.includes('admin'));
});
test('auth stage timings expose token and owner waits without including user identifiers', async () => {
  const h = authHarness(source); await h.run(); const names = h.events.map(e => e.name).filter(n => n.startsWith('mgl_'));
  for (const name of ['mgl_auth_token_started', 'mgl_auth_token_settled', 'mgl_auth_owner_started', 'mgl_auth_owner_settled', 'mgl_auth_access_resolved']) assert.ok(names.includes(name), name);
  assert.ok(names.every(n => !n.includes(h.user.uid) && !n.includes(h.user.email)));
});
test('submission cannot clear a draft before its transaction acknowledgement', async () => {
  const commit = deferred(); const h = submitHarness(source, { commitWait: commit.promise }); const running = h.run();
  await flushAsync(); assert.equal(h.state.cleared, false); assert.equal(h.state.retained, true); commit.resolve(); await running;
  assert.equal(h.state.cleared, true); assert.ok(h.calls.indexOf('commit-acknowledged') < h.calls.indexOf('complete-local'));
});
test('lost transaction response remains unconfirmed and preserves the draft', async () => {
  const h = submitHarness(source, { commitError: new Error('synthetic-response-loss') }); await h.run();
  assert.ok(h.serverPayload); assert.equal(h.state.cleared, false); assert.equal(h.state.retained, true); assert.equal(h.states.at(-1), false);
});
test('stale successful submission keeps the newer local draft', async () => {
  const h = submitHarness(source, { stale: true }); await h.run(); assert.equal(h.state.retained, true); assert.equal(h.state.cleared, false);
});
test('submit stage trace distinguishes server lookup, confirmation and local completion', async () => {
  const h = submitHarness(source); await h.run(); const names = h.events.map(e => e.name);
  for (const name of ['mgl_submit_started', 'mgl_submit_lookup_started', 'mgl_submit_lookup_settled', 'mgl_submit_transaction_started', 'mgl_submit_confirmed', 'mgl_submit_draft_cleared', 'mgl_submit_feedback_started', 'mgl_submit_finished']) assert.ok(names.includes(name), name);
  assert.ok(names.indexOf('mgl_submit_confirmed') < names.indexOf('mgl_submit_draft_cleared'));
  assert.ok(names.every(n => !n.includes('synthetic-owner') && !n.includes('synthetic-session')));
});
