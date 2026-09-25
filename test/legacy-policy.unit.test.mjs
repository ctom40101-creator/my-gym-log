import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEADLINE_MS, FIRST_DELETION_MS, LEGACY_STATES,
  isLegacyTargetPolicy, legacyProductAccess, shouldShowMigrationNotice,
  evaluateDeletion,
} from '../src/services/legacyMigrationPolicy.js';

const uid = 'e2-fixture-uid';
const ownerUid = 'owner-fixture-uid';
const policy = { program: 'LEGACY_ACCOUNT_SUNSET_2026', cohort: 'E2', originalUid: uid,
  deadlineAt: '2026-12-31T15:59:59Z', state: 'LEGACY_PASSWORD_PENDING', deletionHold: false };
const auth = { localId: uid, providerUserInfo: [{ providerId: 'password' }], disabled: false };

test('deadline uses the exact Taipei instant and first deletion window is 00:15 Taipei', () => {
  assert.equal(DEADLINE_MS, Date.parse('2026-12-31T15:59:59Z'));
  assert.equal(FIRST_DELETION_MS, Date.parse('2026-12-31T16:15:00Z'));
  assert.equal(evaluateDeletion({ policy, auth, uid, ownerUid, now: FIRST_DELETION_MS - 1 }).eligible, false);
  assert.equal(evaluateDeletion({ policy, auth, uid, ownerUid, now: FIRST_DELETION_MS }).eligible, true);
});

test('policy contract accepts only exact E2/E3 roster documents and excludes Owner', () => {
  assert.equal(isLegacyTargetPolicy(policy, uid, ownerUid), true);
  assert.equal(isLegacyTargetPolicy({ ...policy, cohort: 'E3' }, uid, ownerUid), true);
  for (const bad of [{ ...policy, cohort: 'E1' }, { ...policy, originalUid: 'different' },
    { ...policy, program: 'other' }, { ...policy, deadlineAt: '2027-01-01T00:00:00Z' }]) {
    assert.equal(isLegacyTargetPolicy(bad, uid, ownerUid), false);
  }
  assert.equal(isLegacyTargetPolicy({ ...policy, originalUid: ownerUid }, ownerUid, ownerUid), false);
});

test('only a pending targeted password account accesses its own product before deadline', () => {
  const user = { uid, providerData: [{ providerId: 'password' }] };
  const claims = { sub: uid, firebase: { sign_in_provider: 'password' } };
  assert.equal(legacyProductAccess(user, claims, policy, ownerUid, DEADLINE_MS - 1), true);
  assert.equal(legacyProductAccess(user, claims, policy, ownerUid, DEADLINE_MS + 1), false);
  assert.equal(legacyProductAccess({ ...user, uid: 'other' }, claims, policy, ownerUid, DEADLINE_MS - 1), false);
  assert.equal(legacyProductAccess(user, { ...claims, firebase: { sign_in_provider: 'anonymous' } }, policy, ownerUid, DEADLINE_MS - 1), false);
});

test('pending and verifying targets see notice while migrated Google users do not', () => {
  for (const state of ['LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING']) {
    assert.equal(shouldShowMigrationNotice({ ...policy, state }, uid, ownerUid), true);
  }
  assert.equal(shouldShowMigrationNotice({ ...policy, state: 'MIGRATED_GOOGLE_ONLY' }, uid, ownerUid), false);
  assert.equal(shouldShowMigrationNotice(null, uid, ownerUid), false);
  assert.equal(shouldShowMigrationNotice({ ...policy, originalUid: ownerUid }, ownerUid, ownerUid), false);
});

test('all seven migration states are explicit and deletion remains narrow', () => {
  assert.deepEqual(LEGACY_STATES, ['LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING',
    'MIGRATED_GOOGLE_ONLY', 'DELETION_HOLD', 'DELETION_ELIGIBLE', 'DELETION_IN_PROGRESS', 'DELETED']);
  for (const state of ['MIGRATED_GOOGLE_ONLY', 'DELETION_HOLD', 'DELETED']) {
    assert.equal(evaluateDeletion({ policy: { ...policy, state }, auth, uid, ownerUid, now: FIRST_DELETION_MS }).eligible, false);
  }
  assert.equal(evaluateDeletion({ policy: { ...policy, deletionHold: true }, auth, uid, ownerUid, now: FIRST_DELETION_MS }).eligible, false);
});

test('Google provider is an absolute deletion veto even when state is stale', () => {
  const linked = { ...auth, providerUserInfo: [...auth.providerUserInfo, { providerId: 'google.com' }] };
  for (const state of ['LEGACY_PASSWORD_PENDING', 'DELETION_ELIGIBLE', 'DELETION_IN_PROGRESS']) {
    assert.equal(evaluateDeletion({ policy: { ...policy, state }, auth: linked, uid, ownerUid, now: FIRST_DELETION_MS }).eligible, false);
  }
});

test('UID mismatch, missing Auth, Owner and non-target all fail closed', () => {
  const input = { policy, auth, uid, ownerUid, now: FIRST_DELETION_MS };
  assert.equal(evaluateDeletion({ ...input, auth: { ...auth, localId: 'new-uid' } }).eligible, false);
  assert.equal(evaluateDeletion({ ...input, auth: null }).eligible, false);
  assert.equal(evaluateDeletion({ ...input, ownerUid: uid }).eligible, false);
  assert.equal(evaluateDeletion({ ...input, policy: { ...policy, cohort: 'E1' } }).eligible, false);
});
