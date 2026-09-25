import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRetention } from '../retention/src/retention.js';
import { FIRST_DELETION_MS } from '../src/services/legacyMigrationPolicy.js';

const uid = 'fixture-e2-uid';
const policy = { program: 'LEGACY_ACCOUNT_SUNSET_2026', cohort: 'E2', originalUid: uid,
  deadlineAt: '2026-12-31T15:59:59Z', state: 'LEGACY_PASSWORD_PENDING', deletionHold: false };
const auth = { localId: uid, email: 'fixture@example.test', providerUserInfo: [], disabled: false };

function fixture(overrides = {}) {
  const calls = [];
  let current = { ...policy };
  let currentAuth = { ...auth };
  const api = {
    getOwnerUid: async () => 'owner-uid',
    listTargets: async () => [{ uid, policy: current, updateTime: 'v1' }],
    getPolicy: async () => ({ policy: current, updateTime: 'v1' }),
    getAuth: async () => currentAuth,
    acquireLock: async () => { calls.push('lock'); current = { ...current, state: 'DELETION_IN_PROGRESS' }; return 'fixture-lock'; },
    assertLock: async () => { calls.push('check-lock'); },
    disableAuth: async () => { calls.push('disable'); currentAuth = { ...currentAuth, disabled: true }; },
    restoreAuth: async () => { calls.push('restore'); currentAuth = { ...currentAuth, disabled: false }; },
    cancelForGoogle: async () => { calls.push('cancel'); current = { ...current, state: 'MIGRATED_GOOGLE_ONLY' }; },
    deletePrivateRecursively: async () => { calls.push('private'); return { complete: true }; },
    deleteIndex: async () => { calls.push('index'); },
    deleteAccessRequest: async () => { calls.push('request'); },
    deleteAuth: async () => { calls.push('auth'); currentAuth = null; },
    markDeleted: async () => { calls.push('receipt'); current = { ...current, state: 'DELETED' }; },
    ...overrides,
  };
  return { api, calls, setAuth: value => { currentAuth = value; }, setPolicy: value => { current = value; } };
}

test('before first Taipei window no deletion side effect occurs', async () => {
  const f = fixture();
  await runRetention(f.api, FIRST_DELETION_MS - 1);
  assert.deepEqual(f.calls, []);
});

test('eligible target follows lock, disable, second checks, recursive data, metadata, Auth, receipt', async () => {
  const f = fixture();
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'check-lock', 'private', 'check-lock', 'index', 'check-lock', 'request', 'check-lock', 'auth', 'receipt']);
});

test('Google linked after lock restores disabled Auth and deletes no data', async () => {
  const f = fixture({ disableAuth: async () => {
    f.calls.push('disable');
    f.setAuth({ ...auth, disabled: true, providerUserInfo: [{ providerId: 'google.com' }] });
  } });
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'restore', 'cancel']);
});

test('Google linked with stale policy is vetoed before lock', async () => {
  const f = fixture();
  f.setAuth({ ...auth, providerUserInfo: [{ providerId: 'google.com' }] });
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, []);
});

test('retry recovers a linked account left disabled after an earlier restore failure', async () => {
  const f = fixture();
  f.setPolicy({ ...policy, state: 'DELETION_IN_PROGRESS' });
  f.setAuth({ ...auth, disabled: true, providerUserInfo: [{ providerId: 'google.com' }] });
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, ['restore', 'cancel']);
});

test('Owner, hold, non-target, UID mismatch, complete state and unavailable owner fail closed', async () => {
  for (const change of [
    { getOwnerUid: async () => uid },
    { getAuth: async () => ({ ...auth, localId: 'other' }) },
    { getPolicy: async () => ({ policy: { ...policy, cohort: 'E1' }, updateTime: 'v1' }) },
    { getPolicy: async () => ({ policy: { ...policy, deletionHold: true }, updateTime: 'v1' }) },
    { getPolicy: async () => ({ policy: { ...policy, state: 'MIGRATED_GOOGLE_ONLY' }, updateTime: 'v1' }) },
  ]) {
    const f = fixture(change);
    await runRetention(f.api, FIRST_DELETION_MS);
    assert.deepEqual(f.calls, []);
  }
  const missingOwner = fixture({ getOwnerUid: async () => null });
  await assert.rejects(runRetention(missingOwner.api, FIRST_DELETION_MS), /owner_ambiguous/);
  assert.deepEqual(missingOwner.calls, []);
});

test('failed lock, partial cleanup and duplicate cron never reach Auth deletion', async () => {
  const failedLock = fixture({ acquireLock: async () => false });
  await runRetention(failedLock.api, FIRST_DELETION_MS);
  assert.deepEqual(failedLock.calls, []);
  const partial = fixture({ deletePrivateRecursively: async () => { partial.calls.push('private'); return { complete: false }; } });
  await runRetention(partial.api, FIRST_DELETION_MS);
  assert.deepEqual(partial.calls, ['lock', 'check-lock', 'disable', 'check-lock', 'private']);
  const concurrent = fixture({ acquireLock: async () => false });
  await Promise.all([runRetention(concurrent.api, FIRST_DELETION_MS), runRetention(concurrent.api, FIRST_DELETION_MS)]);
  assert.deepEqual(concurrent.calls, []);
});

test('cleanup exception leaves Auth and receipt untouched for retry', async () => {
  const f = fixture({ deletePrivateRecursively: async () => { throw new Error('quota'); } });
  await assert.rejects(runRetention(f.api, FIRST_DELETION_MS), /quota/);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'check-lock']);
});

test('lost lock after Auth disable prevents private deletion', async () => {
  const f = fixture({ assertLock: async () => {
    f.calls.push('check-lock');
    if (f.calls.includes('disable')) throw new Error('lock_lost');
  } });
  await assert.rejects(runRetention(f.api, FIRST_DELETION_MS), /lock_lost/);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'check-lock']);
});

test('Google link detected during a private cleanup batch restores Auth and stops later deletes', async () => {
  const f = fixture({ deletePrivateRecursively: async () => {
    f.calls.push('private');
    f.setAuth({ ...auth, disabled: true, providerUserInfo: [{ providerId: 'google.com' }] });
    throw new Error('google_linked_during_cleanup');
  } });
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'check-lock', 'private', 'restore', 'cancel']);
});

test('E3 window proceeds despite E2 needing many cleanup passes', async () => {
  const e3Uid = 'fixture-e3-uid';
  const f = fixture({
    listTargets: async () => [
      { uid, policy, updateTime: 'v1' },
      { uid: e3Uid, policy: { ...policy, cohort: 'E3', originalUid: e3Uid }, updateTime: 'v1' },
    ],
    getPolicy: async targetUid => ({ policy: { ...policy, cohort: targetUid === e3Uid ? 'E3' : 'E2', originalUid: targetUid }, updateTime: 'v1' }),
    getAuth: async targetUid => ({ ...auth, localId: targetUid }),
    deletePrivateRecursively: async targetUid => {
      f.calls.push(`private:${targetUid}`);
      return { complete: false };
    },
  });
  const result = await runRetention(f.api, FIRST_DELETION_MS + 15 * 60_000, 'E3');
  assert.equal(result.deferred, 1);
  assert.equal(f.calls.includes(`private:${uid}`), false);
  assert.equal(f.calls.includes(`private:${e3Uid}`), true);
});

test('Google linkage before metadata deletion restores Auth and stops subsequent cleanup', async () => {
  const f = fixture({ deleteIndex: async () => {
    f.calls.push('index-check');
    f.setAuth({ ...auth, disabled: true, providerUserInfo: [{ providerId: 'google.com' }] });
    throw new Error('google_linked_during_cleanup');
  } });
  await runRetention(f.api, FIRST_DELETION_MS);
  assert.deepEqual(f.calls, ['lock', 'check-lock', 'disable', 'check-lock', 'private',
    'check-lock', 'index-check', 'restore', 'cancel']);
});
