import { DEADLINE_MS, isLegacyTargetPolicy, shouldShowMigrationNotice } from './legacyMigrationPolicy.js';

export const MIGRATION_MESSAGE = '請於 2026/12/31 前完成 Google 帳號連結。期限後仍未完成，本帳號及 My Gym Log 個人資料將永久刪除。';

export function migrationNoticeModel(policy, uid, ownerUid, now = Date.now(), signInKey = 0) {
  const visible = shouldShowMigrationNotice(policy, uid, ownerUid);
  return {
    banner: visible,
    modal: visible,
    signInKey,
    message: visible ? MIGRATION_MESSAGE : '',
    remainingDays: Math.max(0, Math.ceil((DEADLINE_MS - now) / 86_400_000)),
  };
}

export function resetActionSettings() {
  return { url: 'https://my-gym-log.onrender.com/?legacyMigration=1', handleCodeInApp: false };
}

export function verifyLinked(user, uid, originalEmail) {
  if (user?.uid !== uid) throw new Error('uid_mismatch');
  if (!originalEmail || user.email?.toLowerCase() !== originalEmail.toLowerCase()) {
    throw new Error('auth_email_changed');
  }
  if (!user.providerData?.some(item => item.providerId === 'google.com')) {
    throw new Error('google_provider_mismatch');
  }
}

export function linkedGoogleNextStep(user) {
  return user?.emailVerified === true ? 'google-sign-in' : 'verify-original-email';
}

export async function verifyPostLinkSnapshot(user, baseline, readSnapshot) {
  if (linkedGoogleNextStep(user) === 'verify-original-email') return false;
  verifyLegacySnapshot(baseline, await readSnapshot());
  return true;
}

export function verifyLegacySnapshot(before, after) {
  for (const name of ['LogDB', 'PlansDB', 'Settings', 'MovementDB', 'BodyMetricsDB']) {
    const first = before?.[name];
    const second = after?.[name];
    if (!Array.isArray(first) || !Array.isArray(second)
      || first.length !== second.length || first.some((id, index) => id !== second[index])) {
      throw new Error('private_data_mismatch');
    }
  }
}

export function verifyGoogleCompletion(user, token, uid, email, before, after) {
  verifyLinked(user, uid, email);
  if (token?.sub !== uid || token.email?.toLowerCase() !== email.toLowerCase()
    || token.email_verified !== true || token.firebase?.sign_in_provider !== 'google.com') {
    throw new Error('google_token_mismatch');
  }
  verifyLegacySnapshot(before, after);
}

export async function runLegacyMigration({ user, policy, operations }) {
  const uid = user?.uid;
  const originalEmail = user?.email;
  if (!isLegacyTargetPolicy(policy, uid) || user.email === 'ctom40101@gmail.com'
    || !user.providerData?.some(item => item.providerId === 'password')) {
    throw new Error('legacy_identity_mismatch');
  }
  const baseline = await operations.snapshot(uid);
  await operations.beginIntent(uid);
  const linked = await operations.linkGoogle(user);
  verifyLinked(linked, uid, originalEmail);
  verifyLegacySnapshot(baseline, await operations.snapshot(uid));
  const googleUser = await operations.googleSignIn();
  const token = await operations.freshGoogleToken(googleUser);
  verifyGoogleCompletion(googleUser, token, uid, originalEmail, baseline, await operations.snapshot(uid));
  await operations.unlinkPassword(googleUser);
  await operations.complete(uid);
  return { uid, state: 'MIGRATED_GOOGLE_ONLY' };
}
