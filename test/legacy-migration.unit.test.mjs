import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrationNoticeModel, runLegacyMigration, resetActionSettings } from '../src/services/legacyMigration.js';

const uid = 'fixture-original-uid';
const policy = { program: 'LEGACY_ACCOUNT_SUNSET_2026', cohort: 'E2', originalUid: uid,
  deadlineAt: '2026-12-31T15:59:59Z', state: 'LEGACY_PASSWORD_PENDING', deletionHold: false };
const passwordUser = { uid, email: 'fixture@example.test', providerData: [{ providerId: 'password' }] };
const linkedUser = { ...passwordUser, providerData: [{ providerId: 'password' }, { providerId: 'google.com', email: passwordUser.email }] };

test('pending target sees persistent deadline banner and a new modal on each sign-in', () => {
  const a = migrationNoticeModel(policy, uid, 'owner-uid', Date.parse('2026-12-01T00:00:00Z'), 1);
  const b = migrationNoticeModel(policy, uid, 'owner-uid', Date.parse('2026-12-01T00:00:00Z'), 2);
  assert.equal(a.banner, true);
  assert.equal(a.modal, true);
  assert.equal(b.modal, true);
  assert.notEqual(a.signInKey, b.signInKey);
  assert.match(a.message, /2026\/12\/31 前完成 Google 帳號連結/);
  assert.match(a.message, /個人資料將永久刪除/);
  assert.ok(a.remainingDays > 0);
});

test('migrated target, Owner and ordinary Google user see no sunset notice', () => {
  assert.equal(migrationNoticeModel({ ...policy, state: 'MIGRATED_GOOGLE_ONLY' }, uid, 'owner-uid', Date.now(), 1).banner, false);
  assert.equal(migrationNoticeModel(policy, uid, uid, Date.now(), 1).banner, false);
  assert.equal(migrationNoticeModel(null, 'new-google', 'owner-uid', Date.now(), 1).banner, false);
});

test('reset action uses only the production migration continue URL', () => {
  assert.deepEqual(resetActionSettings(), { url: 'https://my-gym-log.onrender.com/?legacyMigration=1', handleCodeInApp: false });
});

test('migration links Google to current user, verifies data and UID, then unlinks password', async () => {
  const steps = [];
  const operations = {
    snapshot: async observedUid => { assert.equal(observedUid, uid); steps.push('snapshot'); return { LogDB: ['log'], PlansDB: [], Settings: ['profile'], MovementDB: ['movement'], BodyMetricsDB: [] }; },
    beginIntent: async () => { steps.push('intent'); },
    linkGoogle: async user => { assert.equal(user.uid, uid); steps.push('link'); return linkedUser; },
    googleSignIn: async () => { steps.push('google-sign-in'); return linkedUser; },
    freshGoogleToken: async () => { steps.push('token'); return { sub: uid, email: passwordUser.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }; },
    unlinkPassword: async () => { steps.push('unlink'); },
    complete: async () => { steps.push('complete'); },
  };
  const result = await runLegacyMigration({ user: passwordUser, policy, operations });
  assert.equal(result.uid, uid);
  assert.deepEqual(steps, ['snapshot', 'intent', 'link', 'snapshot', 'google-sign-in', 'token', 'snapshot', 'unlink', 'complete']);
});

test('UID mismatch or missing private data safely stops before unlink', async () => {
  let unlinked = false;
  const operations = {
    snapshot: async () => ({ LogDB: ['log'], PlansDB: [], Settings: ['profile'], MovementDB: ['movement'], BodyMetricsDB: [] }),
    beginIntent: async () => {},
    linkGoogle: async () => ({ ...linkedUser, uid: 'new-uid' }),
    googleSignIn: async () => { throw new Error('must_not_reach'); },
    unlinkPassword: async () => { unlinked = true; },
  };
  await assert.rejects(runLegacyMigration({ user: passwordUser, policy, operations }), /uid_mismatch/);
  assert.equal(unlinked, false);
});

test('missing plan, log, settings or movement document blocks password unlink', async () => {
  let reads = 0;
  let unlinked = false;
  const snapshot = { LogDB: ['log'], PlansDB: ['plan'], Settings: ['profile'], MovementDB: ['movement'], BodyMetricsDB: [] };
  const operations = {
    snapshot: async () => ++reads === 1 ? snapshot : { ...snapshot, LogDB: [] },
    beginIntent: async () => {},
    linkGoogle: async () => linkedUser,
    unlinkPassword: async () => { unlinked = true; },
  };
  await assert.rejects(runLegacyMigration({ user: passwordUser, policy, operations }), /private_data_mismatch/);
  assert.equal(unlinked, false);
});
