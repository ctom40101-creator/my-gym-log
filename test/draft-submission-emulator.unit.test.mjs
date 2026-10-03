import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SDK_VERSION } from 'firebase/app';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, disableNetwork, doc, enableNetwork, getDocFromServer,
  getDocsFromServer, query, runTransaction, setDoc, where,
} from 'firebase/firestore';
import {
  canClearDraftAfterSubmission, clearDraft, createDraftSession, discoverDraftSubmission,
  loadDraftSession, reconcileDraftSubmission, saveDraftSession,
} from '../src/services/draftStorage.js';

// This is an emulator-required integration file. No skip or fake Firebase adapter.
const PROJECT = 'demo-mygym-security-v1';
const HOST = '127.0.0.1';
const PORT = 8182;
const UID = 'uxr1-s1-emulator-member';
const OTHER = 'uxr1-s1-emulator-other';
// This is a document path contract in the existing rules, not a Firebase project.
const logPath = uid => `artifacts/mygymlog-604bc/users/${uid}/LogDB`;
const runtime = path.resolve(process.env.MGL_EMULATOR_EVIDENCE_DIR || '.runtime-uxr1-s1-emulator');
const evidence = { projectId: PROJECT, host: HOST, port: PORT, sdkVersion: SDK_VERSION,
  runLabel: process.env.MGL_EMULATOR_RUN_LABEL,
  adapter: 'real firebase/firestore with rules-unit-testing synthetic authenticated contexts',
  startedUtc: new Date().toISOString(), cases: [] };
let environment;
let client;
let peer;

class DraftStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const makeDraft = (id, overrides = {}) => createDraftSession(UID, {
  sessionId: id, revision: 4, selectedDate: '2026-10-02', selectedDailyPlanId: 'synthetic-plan',
  lastScreen: 'Log', log: [{ movementName: 'synthetic-row', rpe: '8', note: 'preserve',
    sets: [{ weight: '40', reps: '10' }] }], ...overrides,
});
const payloadFor = draft => {
  const movements = draft.log.map(move => ({ ...move,
    totalVolume: move.sets.reduce((sum, set) => sum + Number(set.weight) * Number(set.reps), 0) }));
  return { date: new Date(draft.selectedDate).getTime(), userId: draft.uid,
    menuId: draft.selectedDailyPlanId || 'custom', submissionId: draft.sessionId,
    submissionRevision: draft.revision, photo: null, movements,
    overallVolume: movements.reduce((sum, move) => sum + move.totalVolume, 0) };
};
const legacyPayload = draft => {
  const result = payloadFor(draft);
  delete result.submissionRevision;
  return result;
};
const storageFor = (draft, legacy = false) => {
  const storage = new DraftStorage();
  if (legacy) {
    const old = { ...draft, version: 2 };
    delete old.submissionIdentity;
    storage.setItem(`gym_log_draft:${draft.uid}`, JSON.stringify(old));
  } else saveDraftSession(storage, draft.uid, draft);
  return storage;
};
function verifiedDatabase(context) {
  const database = context.firestore();
  const actual = database._delegate;
  assert.equal(actual._databaseId.projectId, PROJECT);
  assert.equal(actual._settings.host, `${HOST}:${PORT}`);
  assert.equal(actual._settings.ssl, false);
  return database;
}
const context = uid => environment.authenticatedContext(uid, {
  email: `${uid}@example.invalid`, email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
});
async function seed(id, payload, uid = UID) {
  await environment.withSecurityRulesDisabled(async privileged => {
    await setDoc(doc(verifiedDatabase(privileged), logPath(uid), id), payload);
  });
}
async function snapshot(database = client, uid = UID) {
  const result = await getDocsFromServer(collection(database, logPath(uid)));
  assert.equal(result.metadata.fromCache, false);
  return { count: result.size, records: result.docs.map(item => ({ id: item.id, data: item.data() }))
    .sort((a, b) => a.id.localeCompare(b.id)) };
}
async function version(id, database = client) {
  const result = await getDocFromServer(doc(database, logPath(UID), id));
  assert.equal(result.metadata.fromCache, false);
  assert.ok(result.exists());
  // Real SDK snapshot version measures whether an identical retry wrote again.
  return result._document.version.toMicroseconds();
}
async function submit(database, storage, hooks = {}) {
  const draft = loadDraftSession(storage, UID);
  saveDraftSession(storage, UID, draft);
  const payload = JSON.parse(JSON.stringify(payloadFor(draft)));
  const logs = collection(database, logPath(UID));
  const selection = await discoverDraftSubmission(async () => {
    hooks.onLookup?.();
    const found = await getDocsFromServer(query(logs, where('submissionId', '==', draft.sessionId)));
    assert.equal(found.metadata.fromCache, false);
    return found.docs.map(item => ({ id: item.id, data: item.data() }));
  }, draft.selectedDate, payload, draft.submissionIdentity);
  await hooks.afterDiscovery?.(selection);
  const outcome = await runTransaction(database, async transaction => {
    hooks.onTransactionAttempt?.();
    const result = await reconcileDraftSubmission(transaction, doc(logs, selection.documentId), payload, selection);
    await hooks.afterReconcile?.(result);
    return result;
  });
  if (hooks.loseResponse) throw new Error('Synthetic delivery loss after real SDK transaction commit');
  await hooks.beforeClear?.();
  const latest = loadDraftSession(storage, UID);
  const cleared = canClearDraftAfterSubmission(latest, UID, draft.sessionId, draft.revision);
  if (cleared) clearDraft(storage, UID);
  return { outcome, cleared, selection };
}
function record(name, observations, details = {}) {
  evidence.cases.push({ name, status: 'PASS', observations, ...details });
  writeFileSync(path.join(runtime, 'integration-results.json'), JSON.stringify(evidence, null, 2));
}

before(async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `${HOST}:${PORT}`, 'Explicit loopback Emulator required');
  assert.equal(process.env.GCLOUD_PROJECT, PROJECT);
  assert.equal(process.env.MGL_EMULATOR_NETWORK_GUARD, 'loopback-8182-only');
  environment = await initializeTestEnvironment({ projectId: PROJECT,
    firestore: { host: HOST, port: PORT, rules: readFileSync('firestore.rules', 'utf8') } });
}, { timeout: 45000 });
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async privileged => {
    const database = verifiedDatabase(privileged);
    for (const uid of [UID, OTHER]) await setDoc(doc(database, 'AccessRequests', uid), {
      uid, email: `${uid}@example.invalid`, displayName: 'Synthetic integration member',
      status: 'approved', requestedAt: new Date('2026-10-02T00:00:00Z'),
    });
  });
  client = verifiedDatabase(context(UID));
  peer = verifiedDatabase(context(UID));
});
after(async () => {
  await environment?.cleanup();
  evidence.finishedUtc = new Date().toISOString();
  evidence.status = evidence.cases.length === 16 ? 'PASS' : 'INCOMPLETE';
  writeFileSync(path.join(runtime, 'integration-results.json'), JSON.stringify(evidence, null, 2));
});

test('real SDK date edit updates one canonical document', async () => {
  const draft = makeDraft('date-edit');
  await submit(client, storageFor(draft));
  const first = await snapshot();
  const changed = { ...draft, selectedDate: '2026-10-03', revision: 5 };
  await submit(client, storageFor(changed));
  const final = await snapshot();
  assert.equal(first.count, 1); assert.equal(final.count, 1);
  assert.equal(final.records[0].id, 'session-date-edit');
  assert.deepEqual(final.records[0].data, payloadFor(changed));
  record('date edit same canonical ID', [first, final]);
});

test('real commit then lost response retains draft; retry reconciles count one', async () => {
  const draft = makeDraft('lost-response'); const storage = storageFor(draft);
  await assert.rejects(submit(client, storage, { loseResponse: true }), /delivery loss/);
  assert.deepEqual(loadDraftSession(storage, UID), draft);
  const first = await snapshot(); const committedVersion = await version('session-lost-response');
  assert.equal(first.count, 1);
  const retry = await submit(peer, storage);
  const final = await snapshot();
  assert.equal(retry.outcome, 'reconciled'); assert.equal(retry.cleared, true);
  assert.equal(final.count, 1); assert.deepEqual(final, first);
  assert.equal(await version('session-lost-response'), committedVersion);
  assert.equal(loadDraftSession(storage, UID).log.length, 0);
  record('lost response retains then read-only retry', [first, final], { committedVersion, retry });
});

test('overlapping real transactions retry and cannot overwrite a newer revision', { timeout: 20000 }, async () => {
  const initial = makeDraft('overlap', { revision: 0 });
  await seed('session-overlap', payloadFor(initial));
  const old = { ...initial, revision: 1 }; const storage = storageFor(old);
  const entered = Promise.withResolvers(); const released = Promise.withResolvers();
  let reads = 0;
  let attempts = 0;
  const oldResult = submit(client, storage, { onTransactionAttempt: () => { attempts += 1; }, afterReconcile: async () => {
    reads += 1;
    if (reads === 1) { entered.resolve(); await released.promise; }
  } }).then(value => ({ value }), error => ({ error }));
  await entered.promise;
  const newer = { ...initial, revision: 2, selectedDate: '2026-10-03',
    log: [{ ...initial.log[0], sets: [{ weight: '55', reps: '10' }] }] };
  try { await submit(peer, storageFor(newer)); } finally { released.resolve(); }
  const result = await oldResult;
  assert.match(result.error?.message || '', /newer or incompatible/);
  assert.ok(attempts >= 2, 'Real Firestore optimistic conflict must retry the transaction callback');
  // A retry throws before afterReconcile; verify its newer-payload guard and the final server value.
  const final = await snapshot();
  assert.equal(final.count, 1); assert.deepEqual(final.records[0].data, payloadFor(newer));
  assert.deepEqual(loadDraftSession(storage, UID), old);
  record('overlapping transactions protect newer server payload', [final], { transactionAttempts: attempts, successfulOldReadCallbacks: reads,
    rejectedMessage: result.error.message, oldDraftRetained: true });
});

test('stale success leaves an edited draft; next real transaction submits newer payload', async () => {
  const old = makeDraft('edit-in-flight'); const storage = storageFor(old);
  const newer = { ...old, revision: 5, log: [{ ...old.log[0], note: 'newer note' }] };
  const firstResult = await submit(client, storage, { beforeClear: () => saveDraftSession(storage, UID, newer) });
  assert.equal(firstResult.cleared, false); assert.deepEqual(loadDraftSession(storage, UID), newer);
  const first = await snapshot(); assert.deepEqual(first.records[0].data, payloadFor(old));
  await submit(peer, storage); const final = await snapshot();
  assert.equal(final.count, 1); assert.deepEqual(final.records[0].data, payloadFor(newer));
  record('stale success preserves new local revision', [first, final]);
});

test('stale retry cannot overwrite newer server revision or clear local draft', async () => {
  const draft = makeDraft('stale-retry'); const storage = storageFor(draft);
  const newer = { ...draft, revision: 8, selectedDate: '2026-10-03' };
  await seed('session-stale-retry', payloadFor(newer)); const before = await snapshot();
  await assert.rejects(submit(client, storage), /newer or incompatible/);
  const final = await snapshot(); assert.deepEqual(final, before); assert.equal(final.count, 1);
  assert.deepEqual(loadDraftSession(storage, UID), draft);
  record('stale retry blocked without clear or overwrite', [before, final]);
});

test('identical real transaction retries leave document update version unchanged', async () => {
  const draft = makeDraft('identical'); await seed('session-identical', payloadFor(draft));
  const before = await snapshot(); const priorVersion = await version('session-identical');
  for (let i = 0; i < 3; i += 1) {
    const result = await submit(i % 2 ? peer : client, storageFor(draft));
    assert.equal(result.outcome, 'reconciled');
  }
  const final = await snapshot(); assert.equal(final.count, 1); assert.deepEqual(final, before);
  assert.equal(await version('session-identical'), priorVersion);
  record('three identical retries no duplicate or write', [before, final], { priorVersion });
});

test('unique identical legacy document reconciles read-only with no backfill or rename', async () => {
  const draft = makeDraft('legacy-exact'); const id = '2026-10-02-legacy-exact';
  await seed(id, legacyPayload(draft)); const before = await snapshot(); const priorVersion = await version(id);
  const storage = storageFor(draft, true); const result = await submit(client, storage);
  const final = await snapshot(); assert.equal(result.outcome, 'legacy-reconciled');
  assert.deepEqual(final, before); assert.equal(final.count, 1); assert.equal(await version(id), priorVersion);
  assert.equal(loadDraftSession(storage, UID).log.length, 0);
  assert.equal('submissionRevision' in final.records[0].data, false);
  record('legacy exact read-only reconciliation', [before, final], { priorVersion, result });
});

test('legacy date changed after committed response loss blocks and preserves payload', async () => {
  const draft = makeDraft('legacy-date'); await seed('2026-10-02-legacy-date', legacyPayload(draft));
  const changed = { ...draft, selectedDate: '2026-10-03', revision: 5 };
  const storage = storageFor(changed, true); const preserved = loadDraftSession(storage, UID);
  const before = await snapshot();
  await assert.rejects(submit(client, storage), error => error.code === 'legacy-submission-conflict');
  await assert.rejects(submit(peer, storage), error => error.code === 'legacy-submission-conflict');
  const final = await snapshot(); assert.deepEqual(final, before); assert.equal(final.count, 1);
  assert.deepEqual(loadDraftSession(storage, UID), preserved);
  record('legacy edited date fails closed through retry', [before, final]);
});

test('old and canonical IDs coexist: no automatic choice, merge, overwrite or deletion', async () => {
  const draft = makeDraft('coexist'); await seed('2026-10-02-coexist', legacyPayload(draft));
  await seed('session-coexist', payloadFor({ ...draft, revision: 7 }));
  const storage = storageFor(draft, true); const preserved = loadDraftSession(storage, UID);
  const before = await snapshot();
  await assert.rejects(submit(client, storage), error => error.code === 'submission-identity-conflict');
  const final = await snapshot(); assert.equal(final.count, 2); assert.deepEqual(final, before);
  assert.deepEqual(loadDraftSession(storage, UID), preserved);
  record('coexisting identities blocked preserving two records', [before, final]);
});

test('legacy newer revision cannot be overwritten by an old retry', async () => {
  const draft = makeDraft('legacy-newer'); await seed('2026-10-02-legacy-newer', payloadFor({ ...draft, revision: 8 }));
  const storage = storageFor(draft, true); const preserved = loadDraftSession(storage, UID);
  const before = await snapshot();
  await assert.rejects(submit(client, storage), error => error.code === 'submission-stale-revision');
  const final = await snapshot(); assert.equal(final.count, 1); assert.deepEqual(final, before);
  assert.deepEqual(loadDraftSession(storage, UID), preserved);
  record('legacy newer revision retained', [before, final]);
});

test('legacy disappears between real server lookup and transaction: never recreate', async () => {
  const draft = makeDraft('legacy-disappears'); const id = '2026-10-02-legacy-disappears';
  await seed(id, legacyPayload(draft)); const before = await snapshot();
  const storage = storageFor(draft, true); const preserved = loadDraftSession(storage, UID);
  await assert.rejects(submit(client, storage, { afterDiscovery: selection => {
    assert.equal(selection.documentId, id); return deleteDoc(doc(peer, logPath(UID), id));
  } }), error => error.code === 'submission-identity-disappeared');
  const final = await snapshot(); assert.equal(before.count, 1); assert.equal(final.count, 0);
  assert.deepEqual(loadDraftSession(storage, UID), preserved);
  record('legacy identity disappears no mint or rebuild', [before, final], { fixtureDeletionOnly: true });
});

test('real SDK offline server-only lookup failure cannot fall back to cache or create', async () => {
  const draft = makeDraft('offline'); const storage = storageFor(draft); const before = await snapshot();
  await disableNetwork(client);
  try { await assert.rejects(submit(client, storage), error => error.code === 'unavailable'); }
  finally { await enableNetwork(client); }
  const final = await snapshot(peer); assert.equal(final.count, 0); assert.deepEqual(final, before);
  assert.deepEqual(loadDraftSession(storage, UID), draft);
  record('real server-only offline failure retains draft', [before, final]);
});

test('unproven v2 empty lookup remains blocked and retained after date edit/reload', async () => {
  const draft = makeDraft('v2-unproven'); const storage = storageFor(draft, true);
  const preserved = loadDraftSession(storage, UID); let message;
  await assert.rejects(submit(client, storage), error => {
    message = error.userMessage; return error.code === 'submission-identity-unknown';
  });
  assert.deepEqual(loadDraftSession(storage, UID), preserved);
  const changed = { ...preserved, selectedDate: '2026-10-03', revision: 5 };
  saveDraftSession(storage, UID, changed);
  await assert.rejects(submit(peer, storage), error => error.code === 'submission-identity-unknown');
  assert.deepEqual(loadDraftSession(storage, UID), changed);
  const final = await snapshot(); assert.equal(final.count, 0);
  record('unproven v2 identity no new document', [final], { userMessage: message, draftRetained: true });
});

test('existing rules permit legitimate synthetic UID only its own LogDB', async () => {
  const draft = makeDraft('own-only'); await submit(client, storageFor(draft));
  const other = verifiedDatabase(context(OTHER));
  await assertFails(getDocFromServer(doc(other, logPath(UID), 'session-own-only')));
  await assertFails(getDocsFromServer(collection(other, logPath(UID))));
  await assertFails(setDoc(doc(other, logPath(UID), 'forged'), payloadFor(draft)));
  await assertFails(runTransaction(other, transaction =>
    reconcileDraftSubmission(transaction, doc(other, logPath(UID), 'session-own-only'), payloadFor(draft))));
  await setDoc(doc(other, logPath(OTHER), 'synthetic-own'), { userId: OTHER, value: 'own-only' });
  const own = await snapshot(); const otherOwn = await snapshot(other, OTHER);
  assert.equal(own.count, 1); assert.equal(otherOwn.count, 1);
  record('own UID allowed and foreign UID reads/writes/transaction denied', [own, otherOwn]);
});

test('canonical disappears after discovery: real transaction cannot recreate it', async () => {
  const draft = makeDraft('canonical-disappears'); const id = 'session-canonical-disappears';
  await seed(id, payloadFor(draft)); const before = await snapshot(); const storage = storageFor(draft);
  await assert.rejects(submit(client, storage, { afterDiscovery: () => deleteDoc(doc(peer, logPath(UID), id)) }),
    error => error.code === 'submission-identity-disappeared');
  const final = await snapshot(); assert.equal(before.count, 1); assert.equal(final.count, 0);
  assert.deepEqual(loadDraftSession(storage, UID), draft);
  record('canonical identity disappears no recreation', [before, final], { fixtureDeletionOnly: true });
});

test('equal revision conflicting payload cannot overwrite or clear a real committed draft', async () => {
  const draft = makeDraft('equal-conflict'); await seed('session-equal-conflict', payloadFor(draft));
  const conflict = { ...draft, selectedDate: '2026-10-03' }; const storage = storageFor(conflict);
  const before = await snapshot(); const priorVersion = await version('session-equal-conflict');
  await assert.rejects(submit(client, storage), /Concurrent submission conflict/);
  const final = await snapshot(); assert.equal(final.count, 1); assert.deepEqual(final, before);
  assert.equal(await version('session-equal-conflict'), priorVersion);
  assert.deepEqual(loadDraftSession(storage, UID), conflict);
  record('equal revision different payload fails closed', [before, final], { priorVersion });
});
