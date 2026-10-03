import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canClearDraftAfterSubmission, clearDraft, createDraftSession, discoverDraftSubmission, loadDraft, loadDraftSession, saveDraft, saveDraftSession, submissionDocumentId, visibleDraft, reconcileDraftSubmission, holdDraftEditorLock } from '../src/services/draftStorage.js';

function movement(name) {
  return { movementName: name, sets: [{ weight: 40, reps: 8 }], rpe: 8, note: 'kept' };
}

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('drafts are scoped by Firebase UID and never adopt an unowned legacy draft', () => {
  const local = storage();
  local.setItem('gym_log_draft', JSON.stringify([movement("legacy")]));
  assert.deepEqual(loadDraft(local, 'member-a'), []);
  saveDraft(local, 'member-a', [movement("private-a")]);
  assert.deepEqual(loadDraft(local, 'member-a'), [movement("private-a")]);
  assert.deepEqual(loadDraft(local, 'member-b'), []);
  assert.deepEqual(visibleDraft({ uid: 'member-a', log: [movement("private-a")] }, 'member-b'), []);
});

test('deletion clears both scoped and legacy browser drafts', () => {
  const local = storage();
  local.setItem('gym_log_draft', 'legacy');
  saveDraft(local, 'member-a', [movement("private-a")]);
  clearDraft(local, 'member-a');
  assert.deepEqual(loadDraft(local, 'member-a'), []);
  assert.equal(local.getItem('gym_log_draft'), null);
});

test('invalid persisted draft is ignored', () => {
  const local = storage();
  local.setItem('gym_log_draft:member-a', '{broken');
  assert.deepEqual(loadDraft(local, 'member-a'), []);
  local.setItem('gym_log_draft:member-a', '{}');
  assert.deepEqual(loadDraft(local, 'member-a'), []);
});


test('legacy array draft upgrades into a resumable session without losing log data', () => {
  const local = storage();
  saveDraft(local, 'member-a', [movement("bench")]);
  const session = loadDraftSession(local, 'member-a');
  assert.equal(session.uid, 'member-a');
  assert.equal(session.lastScreen, 'Log');
  assert.equal(typeof session.sessionId, 'string');
  assert.deepEqual(session.log, [movement("bench")]);
});

test('session draft persists route, menu, date, revision and stable submission identity', () => {
  const local = storage();
  const original = createDraftSession('member-a', {
    sessionId: 'submit-123',
    revision: 7,
    log: [movement("row")],
    selectedDailyPlanId: 'plan-a',
    selectedDate: '2026-10-02',
    lastScreen: 'Log',
  });
  saveDraftSession(local, 'member-a', original);
  const restored = loadDraftSession(local, 'member-a');
  assert.equal(restored.sessionId, 'submit-123');
  assert.equal(restored.revision, 7);
  assert.equal(restored.selectedDailyPlanId, 'plan-a');
  assert.equal(restored.selectedDate, '2026-10-02');
  assert.equal(restored.lastScreen, 'Log');
  assert.deepEqual(restored.log, original.log);
});


test('retry uses the same Firestore document identity for one draft session', () => {
  assert.equal(
    submissionDocumentId('2026-10-02', 'submit-123'),
    submissionDocumentId('2026-10-02', 'submit-123')
  );
});

test('only the exact current draft revision may be cleared after submit', () => {
  const draft = createDraftSession('member-a', {
    sessionId: 'submit-123',
    revision: 4,
    log: [movement("bench")],
  });
  assert.equal(canClearDraftAfterSubmission(draft, 'member-a', 'submit-123', 4), true);
  assert.equal(canClearDraftAfterSubmission({ ...draft, revision: 5 }, 'member-a', 'submit-123', 4), false);
  assert.equal(canClearDraftAfterSubmission(draft, 'member-b', 'submit-123', 4), false);
  assert.equal(canClearDraftAfterSubmission(draft, 'member-a', 'submit-456', 4), false);
});

test('a date change retries the same logical submission and validates document IDs', () => {
  assert.equal(submissionDocumentId('2026-10-02', 'submit-123'), submissionDocumentId('2026-10-03', 'submit-123'));
  assert.throws(() => submissionDocumentId('2026-02-30', 'submit-123'));
  assert.throws(() => submissionDocumentId('2026-10-02', '../other'));
});

test('recovery preserves movement order, sets, RPE, notes and other non-photo fields', () => {
  const local = storage();
  const draft = createDraftSession('member-a', {
    sessionId: 'ordered-session', revision: 12, selectedDate: '2026-10-01',
    selectedDailyPlanId: 'plan-a', lastScreen: 'Menu',
    log: [
      { ...movement('row'), order: 1, note: '保留備註', rpe: 9, tempo: '3-1-1', sets: [{ weight: 42.5, reps: 10 }, { weight: 40, reps: 8 }] },
      { ...movement('bench'), order: 2 },
    ],
  });
  saveDraftSession(local, 'member-a', draft);
  assert.deepEqual(loadDraftSession(local, 'member-a'), draft);
});

test('a draft with a foreign embedded UID is rejected instead of relabelled', () => {
  const local = storage();
  const foreign = createDraftSession('member-b', { log: [movement('private-b')] });
  local.setItem('gym_log_draft:member-a', JSON.stringify(foreign));
  assert.deepEqual(loadDraftSession(local, 'member-a').log, []);
  assert.throws(() => saveDraftSession(local, 'member-a', foreign));
  assert.deepEqual(visibleDraft(null, 'member-a'), []);
});

test('corrupt nested fields cannot crash draft rendering or expose another UID', () => {
  const local = storage();
  for (const log of [[null], [{ movementName: {} }], [{ ...movement('row'), sets: [null] }],
    [{ ...movement('row'), note: {} }], [{ ...movement('row'), sets: [{ weight: {} }] }]]) {
    local.setItem('gym_log_draft:member-a', JSON.stringify({ uid: 'member-a', log }));
    assert.deepEqual(loadDraftSession(local, 'member-a').log, []);
    assert.deepEqual(loadDraftSession(local, 'member-b').log, []);
  }
});

test('corrupt metadata is normalized while valid workout content survives', () => {
  const local = storage();
  local.setItem('gym_log_draft:member-a', JSON.stringify({ uid: 'member-a', log: [movement('row')],
    sessionId: {}, revision: -1, selectedDate: 'bad', selectedDailyPlanId: {}, lastScreen: {} }));
  const draft = loadDraftSession(local, 'member-a');
  assert.equal(typeof draft.sessionId, 'string');
  assert.equal(draft.revision, 0);
  assert.equal(draft.selectedDate, null);
  assert.equal(draft.selectedDailyPlanId, '');
  assert.equal(draft.lastScreen, 'Log');
  assert.deepEqual(draft.log, [movement('row')]);
});

test('unavailable storage loads safely and save failure cannot report success', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadDraftSession(blocked, 'member-a').log, []);
  assert.throws(() => saveDraftSession(blocked, 'member-a', createDraftSession('member-a')), /quota/);
  assert.equal(loadDraftSession(blocked, null), null);
});

test('a transient storage read failure is unknown and cannot be persisted over the saved draft', () => {
  const local = storage();
  const original = createDraftSession('member-a', { sessionId: 'protected', log: [movement('row')] });
  saveDraftSession(local, 'member-a', original);
  const unknown = loadDraftSession({ ...local, getItem() { throw new Error('transient read failure'); } }, 'member-a');
  assert.equal(unknown.storageReadFailed, true);
  assert.throws(() => saveDraftSession(local, 'member-a', unknown));
  assert.deepEqual(loadDraftSession(local, 'member-a'), original);
});

function payload(revision = 4, changes = {}) {
  return { userId: 'member-a', submissionId: 'submit-123', submissionRevision: revision,
    date: Date.parse('2026-10-02'), menuId: 'plan-a', photo: null,
    movements: [movement('row')], overallVolume: 320, ...changes };
}

function transactionStore() {
  const documents = new Map();
  let writes = 0;
  const transact = async (reference, value, { afterRead, loseResponse = false, offline = false, selection } = {}) => {
    if (offline) throw new Error('offline');
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = documents.get(reference);
      let pending;
      const result = await reconcileDraftSubmission({
        get: async () => {
          if (afterRead) { await afterRead(); afterRead = null; }
          return { exists: () => !!before, data: () => before };
        },
        set: (_, next) => { pending = structuredClone(next); },
      }, reference, value, selection);
      if (documents.get(reference) !== before) continue;
      if (pending) { documents.set(reference, pending); writes++; }
      if (loseResponse) throw new Error('response lost after commit');
      return result;
    }
    throw new Error('transaction contention');
  };
  return { documents, transact, get writes() { return writes; } };
}

test('committed write with a lost response keeps the draft and retry reconciles without a duplicate write', async () => {
  const remote = transactionStore();
  const local = storage();
  const draft = createDraftSession('member-a', { sessionId: 'submit-123', revision: 4, log: [movement('row')] });
  saveDraftSession(local, 'member-a', draft);
  const reference = submissionDocumentId('2026-10-02', draft.sessionId);
  await assert.rejects(remote.transact(reference, payload(), { loseResponse: true }), /response lost/);
  assert.deepEqual(loadDraftSession(local, 'member-a').log, draft.log);
  assert.equal(await remote.transact(reference, payload()), 'reconciled');
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.writes, 1);
});

function oldPayload(revision) {
  const value = payload();
  if (revision === undefined) delete value.submissionRevision;
  else value.submissionRevision = revision;
  return value;
}

async function compatibleRetry(remote, value, { identity = 'legacy-session', readFailure, afterLookup } = {}) {
  const selection = await discoverDraftSubmission(async () => {
    if (readFailure) throw new Error('server lookup unavailable');
    return [...remote.documents].filter(([, data]) => data.submissionId === value.submissionId)
      .map(([id, data]) => ({ id, data: structuredClone(data) }));
  }, '2026-10-02', value, identity);
  if (afterLookup) afterLookup();
  return remote.transact(selection.documentId, value, { selection });
}

test('legacy committed response-loss retry reconciles the original date-keyed document without a write', async () => {
  const remote = transactionStore();
  remote.documents.set('2026-10-02-submit-123', oldPayload());
  assert.equal(await compatibleRetry(remote, payload()), 'legacy-reconciled');
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.writes, 0);
  assert.equal(remote.documents.has('session-submit-123'), false);
});

test('legacy committed response-loss plus a changed date blocks a second document and preserves the draft', async () => {
  const remote = transactionStore();
  const local = storage();
  const draft = createDraftSession('member-a', { sessionId: 'submit-123', revision: 5,
    selectedDate: '2026-10-03', log: [movement('row')] });
  saveDraftSession(local, 'member-a', draft);
  remote.documents.set('2026-10-02-submit-123', oldPayload());
  await assert.rejects(compatibleRetry(remote, payload(5, { date: Date.parse('2026-10-03') })), /legacy/i);
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.writes, 0);
  assert.deepEqual(loadDraftSession(local, 'member-a'), draft);
});

test('canonical and legacy documents for one session block retry instead of choosing, merging or writing', async () => {
  const remote = transactionStore();
  remote.documents.set('2026-10-02-submit-123', oldPayload());
  remote.documents.set('session-submit-123', payload());
  const before = [...remote.documents];
  await assert.rejects(compatibleRetry(remote, payload()), /multiple|conflict/i);
  assert.deepEqual([...remote.documents], before);
  assert.equal(remote.writes, 0);
});

test('a legacy document with a newer revision blocks an older retry without changing either identity', async () => {
  const remote = transactionStore();
  remote.documents.set('2026-10-02-submit-123', oldPayload(5));
  await assert.rejects(compatibleRetry(remote, payload(4)), /newer/i);
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.documents.get('2026-10-02-submit-123').submissionRevision, 5);
  assert.equal(remote.writes, 0);
});

test('a server lookup failure cannot be treated as no legacy records or a reason to create a new ID', async () => {
  const remote = transactionStore();
  await assert.rejects(compatibleRetry(remote, payload(), { readFailure: true }), /lookup unavailable/);
  assert.equal(remote.documents.size, 0);
  assert.equal(remote.writes, 0);
});

test('an old draft with no discoverable identity fails closed even when the server result is empty', async () => {
  const remote = transactionStore();
  await assert.rejects(compatibleRetry(remote, payload()), /identity/i);
  assert.equal(remote.writes, 0);
  assert.equal(remote.documents.size, 0);
});

test('a legacy identity disappearing after lookup cannot turn reconciliation into creating a new document', async () => {
  const remote = transactionStore();
  remote.documents.set('2026-10-02-submit-123', oldPayload());
  await assert.rejects(compatibleRetry(remote, payload(), { afterLookup: () => remote.documents.clear() }), /disappear|identity/i);
  assert.equal(remote.documents.size, 0);
  assert.equal(remote.writes, 0);
});

test('legacy arrays and repaired missing session IDs retain content but cannot prove safe submission identity', async () => {
  const local = storage();
  for (const raw of [[movement('row')], { uid: 'member-a', version: 2, log: [movement('row')] },
    { uid: 'member-a', version: 2, sessionId: {}, log: [movement('row')] }]) {
    local.setItem('gym_log_draft:member-a', JSON.stringify(raw));
    const restored = loadDraftSession(local, 'member-a');
    assert.equal(restored.submissionIdentity, 'unknown');
    assert.deepEqual(restored.log, [movement('row')]);
    await assert.rejects(compatibleRetry(transactionStore(), payload(), { identity: restored.submissionIdentity }), /identity/i);
  }
});

test('a proven new session can create then reconcile or update the same canonical ID', async () => {
  const remote = transactionStore();
  assert.equal(await compatibleRetry(remote, payload(), { identity: 'session' }), 'written');
  assert.equal(await compatibleRetry(remote, payload(), { identity: 'session' }), 'reconciled');
  assert.equal(await compatibleRetry(remote, payload(5, { date: Date.parse('2026-10-03') }), { identity: 'session' }), 'written');
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.writes, 2);
});

test('version-2 session identity remains legacy after hydration, persist, date edit and reload', () => {
  const local = storage();
  local.setItem('gym_log_draft:member-a', JSON.stringify({ version: 2, uid: 'member-a', sessionId: 'submit-123',
    revision: 4, selectedDate: '2026-10-02', log: [movement('row')], submissionIdentity: 'session' }));
  const restored = loadDraftSession(local, 'member-a');
  assert.equal(restored.submissionIdentity, 'legacy-session');
  saveDraftSession(local, 'member-a', { ...restored, revision: 5, selectedDate: '2026-10-03' });
  const reloaded = loadDraftSession(local, 'member-a');
  assert.equal(reloaded.submissionIdentity, 'legacy-session');
  assert.equal(reloaded.sessionId, 'submit-123');
  assert.equal(reloaded.selectedDate, '2026-10-03');
  assert.deepEqual(reloaded.log, restored.log);
});

test('foreign owner or unrecognized record IDs from lookup cannot authorize a write', async () => {
  for (const record of [
    { id: 'session-submit-123', data: payload(4, { userId: 'member-b' }) },
    { id: 'unexpected-id', data: payload() },
    { id: '2026-02-30-submit-123', data: oldPayload() },
  ]) {
    await assert.rejects(discoverDraftSubmission(async () => [record], '2026-10-02', payload(), 'session'), /identity/i);
  }
});

test('a discovered canonical record disappearing cannot be recreated by an ambiguous old draft', async () => {
  const remote = transactionStore();
  remote.documents.set('session-submit-123', payload());
  await assert.rejects(compatibleRetry(remote, payload(), { afterLookup: () => remote.documents.clear() }), /disappear/i);
  assert.equal(remote.writes, 0);
  assert.equal(remote.documents.size, 0);
});

test('invalid legacy revision metadata blocks reconciliation even when workout content matches', async () => {
  const remote = transactionStore();
  remote.documents.set('2026-10-02-submit-123', oldPayload(-1));
  await assert.rejects(compatibleRetry(remote, payload()), /incompatible/i);
  assert.equal(remote.writes, 0);
});

test('offline failure preserves the draft without any confirmed submission', async () => {
  const remote = transactionStore();
  const local = storage();
  const draft = createDraftSession('member-a', { sessionId: 'submit-123', revision: 4, log: [movement('row')] });
  saveDraftSession(local, 'member-a', draft);
  await assert.rejects(remote.transact('session-submit-123', payload(), { offline: true }), /offline/);
  assert.deepEqual(loadDraftSession(local, 'member-a'), draft);
  assert.equal(remote.writes, 0);
});

test('date and payload changes update one session document using the newer revision', async () => {
  const remote = transactionStore();
  const first = submissionDocumentId('2026-10-02', 'submit-123');
  const retry = submissionDocumentId('2026-10-03', 'submit-123');
  await remote.transact(first, payload());
  await remote.transact(retry, payload(5, { date: Date.parse('2026-10-03') }));
  assert.equal(remote.documents.size, 1);
  assert.equal(remote.documents.get(first).date, Date.parse('2026-10-03'));
});

test('an old revision arriving after a newer commit never overwrites the newer payload', async () => {
  const remote = transactionStore();
  await remote.transact('session-submit-123', payload(5, { menuId: 'new-menu' }));
  await assert.rejects(remote.transact('session-submit-123', payload(4)), /newer/);
  assert.equal(remote.documents.get('session-submit-123').menuId, 'new-menu');
  assert.equal(remote.writes, 1);
});

test('an old transaction reading first retries after a newer commit and is rejected', async () => {
  const remote = transactionStore();
  let resumeOld;
  let oldHasRead;
  const readStarted = new Promise(resolve => { oldHasRead = resolve; });
  const blocked = new Promise(resolve => { resumeOld = resolve; });
  const old = remote.transact('session-submit-123', payload(4), { afterRead: async () => { oldHasRead(); await blocked; } });
  await readStarted;
  await remote.transact('session-submit-123', payload(5, { menuId: 'new-menu' }));
  resumeOld();
  await assert.rejects(old, /newer/);
  assert.equal(remote.documents.get('session-submit-123').submissionRevision, 5);
  assert.equal(remote.writes, 1);
});

test('equal revision conflicts and foreign submission identity fail closed', async () => {
  const remote = transactionStore();
  await remote.transact('session-submit-123', payload());
  await assert.rejects(remote.transact('session-submit-123', payload(4, { menuId: 'conflict' })), /Concurrent/);
  await assert.rejects(remote.transact('session-submit-123', payload(5, { userId: 'member-b' })), /identity/);
  assert.equal(remote.writes, 1);
});

test('stale success cannot clear an edited draft or a newly created session', () => {
  const local = storage();
  const newer = createDraftSession('member-a', { sessionId: 'submit-123', revision: 5, log: [movement('new')] });
  saveDraftSession(local, 'member-a', newer);
  assert.equal(canClearDraftAfterSubmission(loadDraftSession(local, 'member-a'), 'member-a', 'submit-123', 4), false);
  saveDraftSession(local, 'member-a', { ...newer, sessionId: 'next-session', revision: 1 });
  assert.equal(canClearDraftAfterSubmission(loadDraftSession(local, 'member-a'), 'member-a', 'submit-123', 4), false);
  assert.deepEqual(loadDraftSession(local, 'member-a').log, [movement('new')]);
});

function lockManager() {
  const tails = new Map();
  return { request(name, options, callback) {
    assert.equal(options.mode, 'exclusive');
    const done = (tails.get(name) || Promise.resolve()).then(callback);
    tails.set(name, done.catch(() => {}));
    return done;
  } };
}

test('two tabs serialize editing and the queued editor reads the latest saved draft', async () => {
  const locks = lockManager();
  const local = storage();
  const events = [];
  const first = holdDraftEditorLock(locks, 'member-a', () => { events.push('first'); });
  const second = holdDraftEditorLock(locks, 'member-a', () => {
    events.push(loadDraftSession(local, 'member-a').log[0].note);
  });
  await Promise.resolve();
  assert.deepEqual(events, ['first']);
  saveDraftSession(local, 'member-a', createDraftSession('member-a', { log: [{ ...movement('row'), note: 'latest from first tab' }] }));
  first.release();
  await first.done;
  await Promise.resolve();
  assert.deepEqual(events, ['first', 'latest from first tab']);
  second.release();
  await second.done;
});

test('cancelled queued editors never acquire and unrelated UIDs do not share a lock', async () => {
  const locks = lockManager();
  const events = [];
  const first = holdDraftEditorLock(locks, 'member-a', () => events.push('a'));
  const cancelled = holdDraftEditorLock(locks, 'member-a', () => events.push('cancelled'));
  const other = holdDraftEditorLock(locks, 'member-b', () => events.push('b'));
  cancelled.release();
  await Promise.resolve();
  assert.deepEqual(events, ['a', 'b']);
  first.release(); other.release();
  await Promise.all([first.done, cancelled.done, other.done]);
  assert.deepEqual(events, ['a', 'b']);
  assert.throws(() => holdDraftEditorLock(null, 'member-a', () => {}), /cannot safely/);
});
