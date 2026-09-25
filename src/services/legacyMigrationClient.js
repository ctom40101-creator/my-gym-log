import { GoogleAuthProvider, linkWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword,
  signOut, unlink } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, runTransaction, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { APP_ID } from '../constants';
import { DEADLINE_MS, isLegacyTargetPolicy } from './legacyMigrationPolicy';
import { resetActionSettings, verifyGoogleCompletion, verifyLegacySnapshot, verifyLinked } from './legacyMigration';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const progressKey = uid => `my-gym-log:legacy-migration:${uid}`;

export async function loginWithLegacyPassword(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function sendMigrationReset(email) {
  if (!email?.trim()) throw new Error('email_required');
  return sendPasswordResetEmail(auth, email.trim(), resetActionSettings());
}

export async function readLegacyPolicy(uid) {
  const snapshot = await getDoc(doc(db, 'MigrationPolicies', uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function snapshotLegacyData(uid) {
  const base = `artifacts/${APP_ID}/users/${uid}`;
  const result = {};
  for (const name of ['LogDB', 'PlansDB', 'Settings', 'MovementDB', 'BodyMetricsDB']) {
    const snapshot = await getDocs(collection(db, `${base}/${name}`));
    result[name] = snapshot.docs.map(item => item.id).sort();
  }
  return result;
}

export async function beginLegacyIntent(user) {
  if (Date.now() >= DEADLINE_MS) throw new Error('legacy_deadline_passed');
  const policyRef = doc(db, 'MigrationPolicies', user.uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(policyRef);
    const policy = snapshot.exists() ? snapshot.data() : null;
    if (!isLegacyTargetPolicy(policy, user.uid) || user.email === 'ctom40101@gmail.com'
      || !['LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING'].includes(policy.state)) {
      throw new Error('legacy_policy_mismatch');
    }
    transaction.update(policyRef, {
      state: 'GOOGLE_LINKED_VERIFYING', intentExpiresAt: Timestamp.fromMillis(Math.min(DEADLINE_MS, Date.now() + 10 * 60_000)),
    });
  });
  const baseline = await snapshotLegacyData(user.uid);
  sessionStorage.setItem(progressKey(user.uid), JSON.stringify(baseline));
  return baseline;
}

export function readLegacyProgress(uid) {
  try {
    const raw = sessionStorage.getItem(progressKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function linkCurrentLegacyUser(user) {
  const policy = await readLegacyPolicy(user.uid);
  const intentExpiry = policy?.intentExpiresAt?.toMillis?.();
  if (Date.now() >= DEADLINE_MS || !isLegacyTargetPolicy(policy, user.uid)
    || policy.state !== 'GOOGLE_LINKED_VERIFYING'
    || !Number.isFinite(intentExpiry) || intentExpiry <= Date.now()) throw new Error('legacy_intent_expired');
  const linked = await linkWithPopup(user, provider);
  verifyLinked(linked.user, user.uid, user.email);
  const baseline = readLegacyProgress(user.uid);
  if (!baseline) throw new Error('baseline_unavailable');
  verifyLegacySnapshot(baseline, await snapshotLegacyData(user.uid));
  return linked.user;
}

export async function signOutForGoogleVerification() { await signOut(auth); }

export async function finishLegacyGoogleMigration(user) {
  const policy = await readLegacyPolicy(user.uid);
  if (!isLegacyTargetPolicy(policy, user.uid) || policy.state !== 'GOOGLE_LINKED_VERIFYING') {
    throw new Error('legacy_policy_mismatch');
  }
  const token = await user.getIdTokenResult(true);
  const baseline = readLegacyProgress(user.uid);
  if (!baseline) throw new Error('baseline_unavailable');
  verifyGoogleCompletion(user, token.claims, user.uid, user.email,
    baseline, await snapshotLegacyData(user.uid));
  if (user.providerData?.some(item => item.providerId === 'password')) await unlink(user, 'password');
  await updateDoc(doc(db, 'MigrationPolicies', user.uid), { state: 'MIGRATED_GOOGLE_ONLY' });
  sessionStorage.removeItem(progressKey(user.uid));
  return { ...policy, state: 'MIGRATED_GOOGLE_ONLY' };
}
