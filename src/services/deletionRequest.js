import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function markAdminDeletionStarted(db, uid, adminUid) {
  if (!UID_PATTERN.test(uid) || !UID_PATTERN.test(adminUid)) throw new Error('Invalid UID');
  const path = doc(db, 'AccessRequests', uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(path);
    if (!snapshot.exists()) throw new Error('Access request missing');
    const request = snapshot.data();
    if (request.deletionStartedAt || request.selfDeleteRequestedAt) {
      if (request.status !== 'disabled') throw new Error('Deletion state conflict');
      return;
    }
    transaction.update(path, {
      status: 'disabled', deletionStartedAt: serverTimestamp(),
      decidedAt: serverTimestamp(), decidedBy: adminUid,
    });
  });
}
