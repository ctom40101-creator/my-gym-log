import { FIRST_DELETION_MS, evaluateDeletion, isLegacyTargetPolicy } from '../../src/services/legacyMigrationPolicy.js';

export async function runRetention(api, now = Date.now()) {
  const result = { examined: 0, skipped: 0, deferred: 0, deleted: 0 };
  if (!Number.isFinite(now) || now < FIRST_DELETION_MS) return result;
  const ownerUid = await api.getOwnerUid();
  if (!ownerUid) throw new Error('owner_ambiguous');
  const targets = await api.listTargets();
  if (!Array.isArray(targets)) throw new Error('target_roster_unavailable');
  for (const target of targets) {
    const uid = target?.uid;
    result.examined++;
    if (!uid || uid === ownerUid) { result.skipped++; continue; }
    const freshPolicy = await api.getPolicy(uid);
    const initialAuth = await api.getAuth(uid);
    if (!initialAuth && isLegacyTargetPolicy(freshPolicy?.policy, uid, ownerUid)
      && freshPolicy.policy.state === 'DELETION_IN_PROGRESS') {
      if (!await api.verifyCleanup(uid)) throw new Error('cleanup_unverified');
      await api.markDeleted(uid);
      result.deleted++;
      return result;
    }
    const initial = evaluateDeletion({ policy: freshPolicy?.policy, auth: initialAuth, uid, ownerUid, now });
    if (initial.reason === 'google_linked' && freshPolicy?.policy?.state === 'DELETION_IN_PROGRESS') {
      if (initialAuth.disabled) await api.restoreAuth(uid);
      await api.cancelForGoogle(uid);
      result.skipped++;
      return result;
    }
    if (!initial.eligible) { result.skipped++; continue; }
    const lockId = await api.acquireLock(uid, freshPolicy.updateTime, now);
    if (!lockId) { result.deferred++; continue; }
    await api.assertLock(uid, lockId);
    if (!initialAuth.disabled) await api.disableAuth(uid);
    const afterAuth = await api.getAuth(uid);
    const afterPolicy = await api.getPolicy(uid);
    const after = evaluateDeletion({ policy: afterPolicy?.policy, auth: afterAuth, uid, ownerUid, now });
    if (!after.eligible) {
      if (after.reason === 'google_linked') {
        if (afterAuth?.disabled) await api.restoreAuth(uid);
        await api.cancelForGoogle(uid);
      } else if (afterAuth?.disabled && !initialAuth.disabled) {
        await api.restoreAuth(uid);
      }
      result.skipped++;
      return result;
    }
    await api.assertLock(uid, lockId);
    const privateResult = await api.deletePrivateRecursively(uid, lockId);
    if (!privateResult?.complete) { result.deferred++; return result; }
    await api.assertLock(uid, lockId);
    await api.deleteIndex(uid, lockId);
    await api.assertLock(uid, lockId);
    await api.deleteAccessRequest(uid, lockId);
    const finalAuth = await api.getAuth(uid);
    const finalPolicy = await api.getPolicy(uid);
    const final = evaluateDeletion({ policy: finalPolicy?.policy, auth: finalAuth, uid, ownerUid, now });
    if (!final.eligible || !finalAuth?.disabled) {
      if (final.reason === 'google_linked') {
        await api.restoreAuth(uid);
        await api.cancelForGoogle(uid);
      }
      throw new Error('final_identity_ambiguous');
    }
    await api.assertLock(uid, lockId);
    await api.deleteAuth(uid);
    await api.markDeleted(uid, lockId);
    result.deleted++;
    return result;
  }
  return result;
}
