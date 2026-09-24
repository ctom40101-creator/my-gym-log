import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, isVerifiedAdmin } from '../src/services/accessService.js';

const member = { uid: 'member-uid' };
const owner = { uid: 'owner-uid' };
const googleClaims = { email: 'member@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } };

test('product access follows AccessRequests status for a verified Google member', () => {
  assert.equal(decideAccess(member, googleClaims, undefined), 'request_needed');
  for (const status of ['pending', 'approved', 'rejected', 'disabled']) {
    assert.equal(decideAccess(member, googleClaims, { status }), status);
  }
  assert.equal(decideAccess(member, googleClaims, { status: 'unknown' }), 'identity_invalid');
});

test('unverified, password and anonymous identities never reach product data', () => {
  assert.equal(decideAccess(null, null, undefined), 'unauthenticated');
  assert.equal(decideAccess(member, { ...googleClaims, email_verified: false }, { status: 'approved' }), 'identity_invalid');
  assert.equal(decideAccess(member, { ...googleClaims, firebase: { sign_in_provider: 'password' } }, { status: 'approved' }), 'identity_invalid');
  assert.equal(decideAccess(member, { ...googleClaims, email: undefined }, { status: 'approved' }), 'identity_invalid');
});

test('admin requires verified Firebase token email and frozen original UID', () => {
  const verified = { ...googleClaims, email: 'ctom40101@gmail.com' };
  assert.equal(isVerifiedAdmin(verified, owner.uid, 'owner-uid'), true);
  assert.equal(decideAccess(owner, verified, undefined, 'owner-uid'), 'admin');
  assert.equal(isVerifiedAdmin(verified, 'shadow-uid', 'owner-uid'), false);
  assert.equal(decideAccess({ uid: 'shadow-uid' }, verified, undefined, 'owner-uid'), 'request_needed');
  assert.equal(isVerifiedAdmin({ ...verified, email_verified: false }, owner.uid, 'owner-uid'), false);
  assert.equal(decideAccess(owner, { ...verified, email_verified: false }, undefined, 'owner-uid'), 'identity_invalid');
});
