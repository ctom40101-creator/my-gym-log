import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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
beforeEach(async () => env.clearFirestore());
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
});

test('admin access requires a verified owner email in the Firebase token', async () => {
  const c = contexts();
  await seed(privatePath('other-uid'), { nickname: 'other' });
  await assertFails(getDoc(ref(c.unverifiedOwner, privatePath('other-uid'))));
  await assertSucceeds(getDoc(ref(c.owner, privatePath('other-uid'))));
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
