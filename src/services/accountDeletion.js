const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function stagedDeleteUser(uid, operations) {
  if (!UID_PATTERN.test(uid)) throw new Error('Invalid target UID');
  await operations.markDisabled(uid);
  await operations.disableAuth(uid);
  await operations.deletePrivateData(uid);
  await operations.deleteRoot(uid);
  await operations.deleteIndex(uid);
}

export async function stagedSelfDelete(operations) {
  await operations.reauthenticate();
  await operations.revokeAccess();
}

export async function finalizeDeleteUser(uid, operations) {
  if (!UID_PATTERN.test(uid)) throw new Error('Invalid target UID');
  await operations.deleteAuth(uid);
  await operations.deleteMetadata(uid);
}

export async function finalizeSelfDelete(operations) {
  await operations.reauthenticate();
  await operations.deleteAuth();
}
