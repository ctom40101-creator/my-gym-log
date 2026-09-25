export const DEADLINE_MS = Date.parse('2026-12-31T15:59:59Z');
export const FIRST_DELETION_MS = Date.parse('2026-12-31T16:15:00Z');
export const DEADLINE_ISO = '2026-12-31T15:59:59Z';
export const PROGRAM = 'LEGACY_ACCOUNT_SUNSET_2026';
export const LEGACY_STATES = Object.freeze([
  'LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING', 'MIGRATED_GOOGLE_ONLY',
  'DELETION_HOLD', 'DELETION_ELIGIBLE', 'DELETION_IN_PROGRESS', 'DELETED',
]);

export function isLegacyTargetPolicy(policy, uid, ownerUid) {
  return !!uid && (!ownerUid || uid !== ownerUid) && policy?.program === PROGRAM
    && (policy.cohort === 'E2' || policy.cohort === 'E3')
    && policy.originalUid === uid && policy.deadlineAt === DEADLINE_ISO
    && LEGACY_STATES.includes(policy.state) && typeof policy.deletionHold === 'boolean';
}

export function legacyProductAccess(user, claims, policy, ownerUid, now = Date.now()) {
  return isLegacyTargetPolicy(policy, user?.uid, ownerUid)
    && claims?.sub === user.uid && claims.firebase?.sign_in_provider === 'password'
    && user.providerData?.some(item => item.providerId === 'password')
    && ['LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING'].includes(policy.state)
    && Number.isFinite(now) && now <= DEADLINE_MS;
}

export function shouldShowMigrationNotice(policy, uid, ownerUid) {
  return isLegacyTargetPolicy(policy, uid, ownerUid)
    && ['LEGACY_PASSWORD_PENDING', 'GOOGLE_LINKED_VERIFYING'].includes(policy.state);
}

export function evaluateDeletion({ policy, auth, uid, ownerUid, now = Date.now() }) {
  const no = reason => ({ eligible: false, reason });
  if (!ownerUid) return no('owner_ambiguous');
  if (!isLegacyTargetPolicy(policy, uid, ownerUid)) return no('not_target');
  if (!Number.isFinite(now) || now < FIRST_DELETION_MS || now <= DEADLINE_MS) return no('before_window');
  if (!auth || auth.localId !== uid || !Array.isArray(auth.providerUserInfo)) return no('auth_ambiguous');
  if (auth.providerUserInfo.some(item => item.providerId === 'google.com')) return no('google_linked');
  if (policy.deletionHold || ['DELETION_HOLD', 'MIGRATED_GOOGLE_ONLY', 'DELETED'].includes(policy.state)) return no('protected_state');
  if (policy.state === 'GOOGLE_LINKED_VERIFYING') {
    const intentExpiry = Date.parse(policy.intentExpiresAt || '');
    if (!Number.isFinite(intentExpiry) || now <= intentExpiry) return no('migration_in_progress');
  }
  return { eligible: true, reason: 'eligible' };
}
