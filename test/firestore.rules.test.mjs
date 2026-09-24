import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { createMockUserToken } from '@firebase/util';
import { inspectDeletionCandidate, issueDeletionClearance } from '../tools/deletion-clearance/verify.js';
import { markAdminDeletionStarted } from '../src/services/deletionRequest.js';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const projectId = 'demo-mygym-security-v1';
const base = 'artifacts/mygymlog-604bc';
const requestPath = uid => `AccessRequests/${uid}`;
const indexPath = uid => `${base}/public/data/UserIndex/${uid}`;
const privatePath = uid => `${base}/users/${uid}/Settings/profile`;
let env;

const token = (email, verified = true, provider = 'google.com') => ({
  email,
  email_verified: verified,
  firebase: { sign_in_provider: provider },
});
const contexts = () => ({
  nobody: env.unauthenticatedContext(),
  owner: env.authenticatedContext('owner-uid', token('ctom40101@gmail.com')),
  unverifiedOwner: env.authenticatedContext('owner-uid', token('ctom40101@gmail.com', false)),
  approved: env.authenticatedContext('member-uid', token('member@example.test')),
  pending: env.authenticatedContext('pending-uid', token('pending@example.test')),
  disabled: env.authenticatedContext('disabled-uid', token('disabled@example.test')),
  other: env.authenticatedContext('other-uid', token('other@example.test')),
  anonymous: env.authenticatedContext('guest-uid', token(undefined, false, 'anonymous')),
});
const ref = (ctx, path) => doc(ctx.firestore(), path);
async function seed(path, data) {
  await env.withSecurityRulesDisabled(async ctx => setDoc(ref(ctx, path), data));
}
async function access(uid, status) {
  await seed(requestPath(uid), { uid, email: `${uid}@example.test`, displayName: uid, status, requestedAt: new Date() });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed('SecurityConfig/owner', { uid: 'owner-uid', email: 'ctom40101@gmail.com' });
});
after(async () => env?.cleanup());

test('pending and disabled accounts cannot read private training data', async () => {
  const c = contexts();
  await access('pending-uid', 'pending');
  await access('disabled-uid', 'disabled');
  await seed(privatePath('pending-uid'), { nickname: 'private' });
  await assertFails(getDoc(ref(c.pending, privatePath('pending-uid'))));
  await assertFails(getDoc(ref(c.disabled, privatePath('pending-uid'))));
});

test('approved account can read and write only its own private data', async () => {
  const c = contexts();
  await access('member-uid', 'approved');
  await assertSucceeds(setDoc(ref(c.approved, privatePath('member-uid')), { nickname: 'member' }));
  await assertSucceeds(getDoc(ref(c.approved, privatePath('member-uid'))));
  await assertFails(getDoc(ref(c.approved, privatePath('other-uid'))));
  await assertFails(setDoc(ref(c.approved, privatePath('other-uid')), { nickname: 'other' }));
  await seed(`${base}/users/member-uid`, { legacyRoot: true });
  await assertSucceeds(deleteDoc(ref(c.approved, `${base}/users/member-uid`)));
  await seed(`${base}/users/pending-uid`, { legacyRoot: true });
  await assertFails(deleteDoc(ref(c.pending, `${base}/users/pending-uid`)));
});

test('private writes are limited to the five product collections and stop after disable', async () => {
  const c = contexts();
  await access('member-uid', 'approved');
  await assertFails(setDoc(ref(c.approved, `${base}/users/member-uid/Unknown/doc`), { value: 1 }));
  await assertFails(setDoc(ref(c.approved, `${base}/users/member-uid/Settings/profile/Nested/doc`), { value: 1 }));
  await seed(privatePath('member-uid'), { value: 1 });
  await assertSucceeds(updateDoc(ref(c.owner, requestPath('member-uid')), {
    status: 'disabled', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
  await assertFails(setDoc(ref(c.owner, privatePath('member-uid')), { value: 2 }));
  await assertSucceeds(deleteDoc(ref(c.owner, privatePath('member-uid'))));
});

test('admin access requires a verified owner email in the Firebase token', async () => {
  const c = contexts();
  await seed(privatePath('other-uid'), { nickname: 'other' });
  await assertFails(getDoc(ref(c.unverifiedOwner, privatePath('other-uid'))));
  await assertSucceeds(getDoc(ref(c.owner, privatePath('other-uid'))));
});

test('same verified owner email on another UID cannot inherit admin access', async () => {
  const c = contexts();
  const collision = env.authenticatedContext('shadow-owner-uid', token('ctom40101@gmail.com'));
  await seed(privatePath('other-uid'), { nickname: 'other' });
  await assertFails(getDoc(ref(collision, privatePath('other-uid'))));
  await assertFails(getDocs(collection(collision.firestore(), 'AccessRequests')));
  await assertFails(getDoc(ref(collision, 'SecurityConfig/owner')));
  await assertSucceeds(getDoc(ref(c.owner, 'SecurityConfig/owner')));
});

test('inventory clearance is readable by target and admin but cannot be written by clients', async () => {
  const c = contexts();
  const path = 'DeletionClearances/disabled-uid';
  const payload = { uid: 'disabled-uid', email: 'disabled@example.test', requestUpdateTime: '2026-09-24T00:00:00Z' };
  await seed(path, payload);
  await assertSucceeds(getDoc(ref(c.disabled, path)));
  await assertSucceeds(getDoc(ref(c.owner, path)));
  await assertFails(getDoc(ref(c.other, path)));
  await assertFails(setDoc(ref(c.disabled, path), payload));
  await assertFails(setDoc(ref(c.owner, path), payload));
  await access('disabled-uid', 'disabled');
  await assertFails(deleteDoc(ref(c.owner, path)));
  await assertSucceeds(deleteDoc(ref(c.owner, requestPath('disabled-uid'))));
  await assertSucceeds(deleteDoc(ref(c.owner, path)));
});

test('admin removes disabled request and clearance atomically after Auth deletion', async () => {
  const c = contexts();
  await access('member-uid', 'disabled');
  await seed('DeletionClearances/member-uid', {
    uid: 'member-uid', email: 'member@example.test', requestUpdateTime: '2026-09-24T00:00:00Z',
  });
  const batch = writeBatch(c.owner.firestore());
  batch.delete(ref(c.owner, requestPath('member-uid')));
  batch.delete(ref(c.owner, 'DeletionClearances/member-uid'));
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(ref(c.owner, 'DeletionClearances/member-uid'))).exists(), false);
});

test('Google user can create and read only their own pending request', async () => {
  const c = contexts();
  await assertSucceeds(setDoc(ref(c.pending, requestPath('pending-uid')), {
    uid: 'pending-uid', email: 'pending@example.test', displayName: 'Pending',
    status: 'pending', requestedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(ref(c.pending, requestPath('pending-uid'))));
  await assertFails(getDoc(ref(c.pending, requestPath('other-uid'))));
  await assertFails(setDoc(ref(c.pending, requestPath('other-uid')), {
    uid: 'other-uid', email: 'pending@example.test', status: 'pending', requestedAt: serverTimestamp(),
  }));
});

test('requester cannot approve, rewrite, or delete their own request', async () => {
  const c = contexts();
  await access('pending-uid', 'pending');
  await assertFails(updateDoc(ref(c.pending, requestPath('pending-uid')), { status: 'approved' }));
  await assertFails(deleteDoc(ref(c.pending, requestPath('pending-uid'))));
  await assertFails(setDoc(ref(c.other, requestPath('other-uid')), {
    uid: 'other-uid', email: 'other@example.test', displayName: 'Other',
    status: 'approved', requestedAt: serverTimestamp(),
  }));
});

test('approved member may revoke own access for deletion but cannot restore or alter identity', async () => {
  const c = contexts();
  await seed(requestPath('member-uid'), {
    uid: 'member-uid', email: 'member@example.test', displayName: 'Member',
    status: 'approved', requestedAt: new Date(),
  });
  await assertFails(updateDoc(ref(c.approved, requestPath('member-uid')), { status: 'disabled', email: 'other@example.test', selfDeleteRequestedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref(c.approved, requestPath('member-uid')), { status: 'disabled', selfDeleteRequestedAt: serverTimestamp() }));
  await assertFails(setDoc(ref(c.approved, privatePath('member-uid')), { value: 'stale token write' }));
  await assertFails(getDoc(ref(c.approved, privatePath('member-uid'))));
  await assertFails(updateDoc(ref(c.approved, requestPath('member-uid')), { status: 'approved' }));
  await assertFails(updateDoc(ref(c.owner, requestPath('member-uid')), {
    status: 'approved', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
});

test('self deletion intent revokes all private reads and writes until Admin cleanup', async () => {
  const c = contexts();
  await seed(requestPath('member-uid'), {
    uid: 'member-uid', email: 'member@example.test', displayName: 'Member',
    status: 'approved', requestedAt: new Date(),
  });
  await seed(privatePath('member-uid'), { value: 'old' });
  await seed(`${base}/users/member-uid`, { legacyRoot: true });
  await seed(indexPath('member-uid'), { uid: 'member-uid', email: 'member@example.test', isAnonymous: false });
  await assertSucceeds(updateDoc(ref(c.approved, requestPath('member-uid')), {
    status: 'disabled', selfDeleteRequestedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(ref(c.approved, privatePath('member-uid')), { value: 'new' }));
  await assertFails(setDoc(ref(c.approved, indexPath('member-uid')), { uid: 'member-uid', email: 'member@example.test', isAnonymous: false }));
  await assertFails(getDocs(collection(c.approved.firestore(), `${base}/users/member-uid/Settings`)));
  await assertFails(deleteDoc(ref(c.approved, privatePath('member-uid'))));
  await assertFails(deleteDoc(ref(c.approved, `${base}/users/member-uid`)));
  await assertFails(deleteDoc(ref(c.approved, indexPath('member-uid'))));
  await assertSucceeds(deleteDoc(ref(c.owner, privatePath('member-uid'))));
  await assertSucceeds(deleteDoc(ref(c.owner, `${base}/users/member-uid`)));
  await assertSucceeds(deleteDoc(ref(c.owner, indexPath('member-uid'))));
});

test('admin deletion marker locks a disabled request against reapproval', async () => {
  const c = contexts();
  await access('member-uid', 'approved');
  await assertSucceeds(markAdminDeletionStarted(c.owner.firestore(), 'member-uid', 'owner-uid'));
  assert.equal((await getDoc(ref(c.owner, requestPath('member-uid')))).data().status, 'disabled');
  await assertSucceeds(markAdminDeletionStarted(c.owner.firestore(), 'member-uid', 'owner-uid'));
  await assertFails(updateDoc(ref(c.owner, requestPath('member-uid')), {
    status: 'approved', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
});

test('admin can list requests and decide an existing request', async () => {
  const c = contexts();
  await access('pending-uid', 'pending');
  await assertSucceeds(getDocs(collection(c.owner.firestore(), 'AccessRequests')));
  await assertSucceeds(updateDoc(ref(c.owner, requestPath('pending-uid')), {
    status: 'approved', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
});

test('only verified admin can remove a request during staged account deletion', async () => {
  const c = contexts();
  await access('other-uid', 'disabled');
  await assertFails(deleteDoc(ref(c.other, requestPath('other-uid'))));
  await assertFails(deleteDoc(ref(c.unverifiedOwner, requestPath('other-uid'))));
  await assertSucceeds(deleteDoc(ref(c.owner, requestPath('other-uid'))));
});

test('anonymous and unverified identities cannot submit requests', async () => {
  const c = contexts();
  const payload = { uid: 'guest-uid', email: 'guest@example.test', displayName: 'Guest', status: 'pending', requestedAt: serverTimestamp() };
  await assertFails(setDoc(ref(c.anonymous, requestPath('guest-uid')), payload));
  await assertFails(setDoc(ref(c.unverifiedOwner, requestPath('owner-uid')), { ...payload, uid: 'owner-uid', email: 'ctom40101@gmail.com' }));
});

test('UserIndex identity fields cannot be forged or changed', async () => {
  const c = contexts();
  await access('member-uid', 'approved');
  await assertFails(setDoc(ref(c.approved, indexPath('other-uid')), {
    uid: 'other-uid', email: 'member@example.test', isAnonymous: false,
  }));
  await assertFails(setDoc(ref(c.approved, indexPath('member-uid')), {
    uid: 'member-uid', email: 'wrong@example.test', isAnonymous: false,
  }));
  await assertSucceeds(setDoc(ref(c.approved, indexPath('member-uid')), {
    uid: 'member-uid', email: 'member@example.test', isAnonymous: false, nickname: 'Member', lastLogin: Date.now(),
  }));
  await assertFails(updateDoc(ref(c.approved, indexPath('member-uid')), { email: 'hijacked@example.test' }));
  await assertFails(updateDoc(ref(c.owner, indexPath('member-uid')), { email: 'hijacked@example.test' }));
});

test('admin cannot recreate a disabled UserIndex after inventory clearance', async () => {
  const c = contexts();
  await access('member-uid', 'disabled');
  await seed(indexPath('member-uid'), { uid: 'member-uid', email: 'member@example.test', isAnonymous: false });
  await assertFails(updateDoc(ref(c.owner, indexPath('member-uid')), { nickname: 'stale write' }));
  await assertSucceeds(deleteDoc(ref(c.owner, indexPath('member-uid'))));
  await assertFails(setDoc(ref(c.owner, indexPath('member-uid')), {
    uid: 'member-uid', email: 'member@example.test', isAnonymous: false,
  }));
});

test('only verified admin can list UserIndex and other public paths deny access', async () => {
  const c = contexts();
  await access('member-uid', 'approved');
  await assertFails(getDocs(collection(c.approved.firestore(), `${base}/public/data/UserIndex`)));
  await assertFails(getDocs(collection(c.unverifiedOwner.firestore(), `${base}/public/data/UserIndex`)));
  await assertSucceeds(getDocs(collection(c.owner.firestore(), `${base}/public/data/UserIndex`)));
  await assertFails(setDoc(ref(c.owner, `${base}/public/data/OtherCollection/doc1`), { x: 1 }));
  await assertFails(getDoc(ref(c.approved, `${base}/public/data/OtherCollection/doc1`)));
});

test('verified admin can bootstrap own UserIndex without an AccessRequest document', async () => {
  const c = contexts();
  await assertSucceeds(setDoc(ref(c.owner, indexPath('owner-uid')), {
    uid: 'owner-uid', email: 'ctom40101@gmail.com', isAnonymous: false,
  }));
});

test('integrated request, approval, data access, and disable transition', async () => {
  const c = contexts();
  const request = ref(c.pending, requestPath('pending-uid'));
  const data = ref(c.pending, privatePath('pending-uid'));
  await assertSucceeds(setDoc(request, {
    uid: 'pending-uid', email: 'pending@example.test', displayName: 'Pending',
    status: 'pending', requestedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(data, { value: 'before approval' }));
  await assertSucceeds(updateDoc(ref(c.owner, requestPath('pending-uid')), {
    status: 'approved', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
  await assertSucceeds(setDoc(data, { value: 'after approval' }));
  await assertSucceeds(getDoc(data));
  await assertSucceeds(updateDoc(ref(c.owner, requestPath('pending-uid')), {
    status: 'disabled', decidedAt: serverTimestamp(), decidedBy: 'owner-uid',
  }));
  await assertFails(getDoc(data));
  await assertSucceeds(deleteDoc(ref(c.owner, requestPath('pending-uid'))));
});

test('Firestore REST inventory detects unknown collections under a missing user document', async () => {
  await seed(`${base}/users/member-uid/Unexpected/parent/Nested/leaf`, { value: 'must remain visible' });
  const jwt = createMockUserToken({ sub: 'owner-uid', email: 'ctom40101@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }, projectId);
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'Firestore emulator host must be configured');
  const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/${base}/users/member-uid:listCollectionIds`;
  const denied = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pageSize: 1 }),
  });
  assert.equal(denied.status, 403);
  const result = await fetch(url, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ pageSize: 1 }),
  });
  const body = await result.text();
  assert.equal(result.status, 200, body);
  assert.deepEqual(JSON.parse(body).collectionIds, ['Unexpected']);
});

test('privileged inventory tool rejects orphaned nested data and issues only after cleanup', async () => {
  await seed(requestPath('member-uid'), {
    uid: 'member-uid', email: 'member@example.test', status: 'disabled', requestedAt: new Date(),
    deletionStartedAt: new Date(),
  });
  const nested = `${base}/users/member-uid/Unexpected/parent/Nested/leaf`;
  await seed(nested, { value: 'orphaned' });
  const fetchImpl = (input, init) => fetch(String(input).replace('https://firestore.googleapis.com', `http://${process.env.FIRESTORE_EMULATOR_HOST}`), init);
  const options = {
    projectId, appId: 'mygymlog-604bc', uid: 'member-uid', email: 'member@example.test', token: 'owner', fetchImpl,
  };
  await assert.rejects(inspectDeletionCandidate(options), /Private data collections remain/);
  await env.withSecurityRulesDisabled(async ctx => deleteDoc(ref(ctx, nested)));
  const result = await issueDeletionClearance({ ...options, commit: true });
  assert.equal(result.issued, true);
  const c = contexts();
  assert.equal((await getDoc(ref(c.owner, 'DeletionClearances/member-uid'))).data().requestUpdateTime, result.requestUpdateTime);
});
