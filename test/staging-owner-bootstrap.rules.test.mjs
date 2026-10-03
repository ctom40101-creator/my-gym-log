import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { bootstrapStagingOwnerConfig } from '../src/services/accessService.js';

const PROJECT = 'demo-mygym-staging-bootstrap';
const HOST = '127.0.0.1';
const PORT = 8183;
const OWNER_EMAIL = 'ctom40101@gmail.com';
const OWNER_UID = 'staging-owner-uid';
const OTHER_UID = 'staging-other-uid';

let env;
const googleClaims = email => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
});
const database = (uid, claims = googleClaims(OWNER_EMAIL)) =>
  env.authenticatedContext(uid, claims).firestore();
const ownerRef = db => doc(db, 'SecurityConfig', 'owner');

before(async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `${HOST}:${PORT}`);
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      host: HOST,
      port: PORT,
      rules: readFileSync('firestore.staging.rules', 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});

after(async () => {
  await env?.cleanup();
});

test('verified canonical owner can read absent owner config and bootstrap it once', async () => {
  const db = database(OWNER_UID);
  const absent = await assertSucceeds(getDoc(ownerRef(db)));
  assert.equal(absent.exists(), false);

  const bootstrappedUid = await bootstrapStagingOwnerConfig(
    db, { uid: OWNER_UID }, googleClaims(OWNER_EMAIL), 'staging');
  assert.equal(bootstrappedUid, OWNER_UID);

  const created = await assertSucceeds(getDoc(ownerRef(db)));
  assert.equal(created.data().uid, OWNER_UID);
  assert.equal(created.data().environment, 'staging');
});

test('non-owner Google identity cannot read or create owner config', async () => {
  const db = database(OTHER_UID, googleClaims('other@example.invalid'));
  await assertFails(getDoc(ownerRef(db)));
  await assertFails(setDoc(ownerRef(db), {
    uid: OTHER_UID,
    email: 'other@example.invalid',
    environment: 'staging',
  }));
});
test('owner bootstrap rejects forged payload fields and UID mismatch', async () => {
  const db = database(OWNER_UID);
  await assertFails(setDoc(ownerRef(db), {
    uid: OTHER_UID,
    email: OWNER_EMAIL,
    environment: 'staging',
  }));
  await assertFails(setDoc(ownerRef(db), {
    uid: OWNER_UID,
    email: OWNER_EMAIL,
    environment: 'staging',
    unexpected: true,
  }));
});

test('existing owner config cannot be overwritten through staging bootstrap rule', async () => {
  await env.withSecurityRulesDisabled(async privileged => {
    await setDoc(ownerRef(privileged.firestore()), {
      uid: OWNER_UID,
      email: OWNER_EMAIL,
      environment: 'staging',
    });
  });

  const db = database(OWNER_UID);
  await assertFails(updateDoc(ownerRef(db), { uid: OTHER_UID }));
  const preserved = await assertSucceeds(getDoc(ownerRef(db)));
  assert.equal(preserved.data().uid, OWNER_UID);
});

test('production environment never executes staging owner bootstrap write', async () => {
  const db = database(OWNER_UID);
  const result = await bootstrapStagingOwnerConfig(
    db, { uid: OWNER_UID }, googleClaims(OWNER_EMAIL), 'production');
  assert.equal(result, null);
  const absent = await assertSucceeds(getDoc(ownerRef(db)));
  assert.equal(absent.exists(), false);
});
