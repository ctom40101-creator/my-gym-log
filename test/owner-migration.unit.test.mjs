import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyBeforeLink, verifyAfterLink } from '../tools/owner-migration/guard.js';

const owner = { uid: 'original-owner-uid', email: 'ctom40101@gmail.com', providerData: [{ providerId: 'password' }] };

test('linking starts only from the existing Owner UID and email', () => {
  assert.doesNotThrow(() => verifyBeforeLink(owner, 'original-owner-uid'));
  assert.throws(() => verifyBeforeLink(owner, 'different-uid'));
  assert.throws(() => verifyBeforeLink({ ...owner, email: 'other@example.test' }, owner.uid));
  assert.throws(() => verifyBeforeLink({ ...owner, providerData: [{ providerId: 'google.com' }] }, owner.uid));
});

test('link receipt accepts only original UID and matching Google provider email', () => {
  const linked = { ...owner, providerData: [{ providerId: 'password' }, { providerId: 'google.com', email: owner.email }] };
  assert.doesNotThrow(() => verifyAfterLink(linked, owner.uid));
  assert.throws(() => verifyAfterLink({ ...linked, uid: 'new-uid' }, owner.uid));
  assert.throws(() => verifyAfterLink({ ...linked, providerData: [{ providerId: 'google.com', email: 'other@example.test' }] }, owner.uid));
});
