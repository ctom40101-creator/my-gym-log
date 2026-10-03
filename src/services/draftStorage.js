const DRAFT_VERSION = 3;

function key(uid) {
  if (typeof uid !== 'string' || !uid) throw new Error('Firebase UID required');
  return `gym_log_draft:${uid}`;
}

export function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDraftSession(uid, overrides = {}) {
  if (typeof uid !== 'string' || !uid) throw new Error('Firebase UID required');
  return {
    version: DRAFT_VERSION,
    uid,
    sessionId: null,
    submissionIdentity: 'session',
    revision: 0,
    log: [],
    selectedDailyPlanId: '',
    selectedDate: null,
    lastScreen: 'Profile',
    ...overrides,
  };
}

function normalizeDraft(raw, uid) {
  if (Array.isArray(raw)) {
    if (!validLog(raw)) return createDraftSession(uid);
    return createDraftSession(uid, {
      sessionId: raw.length ? createSessionId() : null,
      submissionIdentity: raw.length ? 'unknown' : 'session',
      log: raw,
      lastScreen: raw.length ? 'Log' : 'Profile',
    });
  }
  if (!raw || typeof raw !== 'object' || !validLog(raw.log)
    || (raw.uid !== undefined && raw.uid !== uid)) {
    return createDraftSession(uid);
  }
  const validSessionId = typeof raw.sessionId === 'string' && /^[a-zA-Z0-9_-]+$/.test(raw.sessionId);
  const identity = raw.version === DRAFT_VERSION
    && ['session', 'legacy-session', 'unknown'].includes(raw.submissionIdentity)
    ? raw.submissionIdentity : 'legacy-session';
  return createDraftSession(uid, {
    ...raw,
    uid,
    version: DRAFT_VERSION,
    sessionId: validSessionId ? raw.sessionId : (raw.log.length ? createSessionId() : null),
    submissionIdentity: validSessionId ? identity : (raw.log.length ? 'unknown' : 'session'),
    revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    selectedDailyPlanId: typeof raw.selectedDailyPlanId === 'string' ? raw.selectedDailyPlanId : '',
    selectedDate: validDate(raw.selectedDate) ? raw.selectedDate : null,
    lastScreen: ['Log', 'Menu', 'Library', 'Analysis', 'Profile', 'Admin'].includes(raw.lastScreen)
      ? raw.lastScreen : (raw.log.length ? 'Log' : 'Profile'),
  });
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validLog(log) {
  const field = value => value === undefined || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
  return Array.isArray(log) && log.every(move => move && typeof move === 'object'
    && typeof move.movementName === 'string' && Array.isArray(move.sets)
    && field(move.note) && field(move.rpe)
    && move.sets.every(set => set && typeof set === 'object' && field(set.weight) && field(set.reps)));
}

export function loadDraftSession(storage, uid) {
  if (!uid) return null;
  let stored;
  try {
    stored = storage.getItem(key(uid));
  } catch {
    // An unreadable draft is unknown, not an empty draft that may be cleared.
    return createDraftSession(uid, { storageReadFailed: true });
  }
  try {
    return normalizeDraft(stored ? JSON.parse(stored) : null, uid);
  } catch {
    return createDraftSession(uid);
  }
}

export function saveDraftSession(storage, uid, session) {
  if (!session || typeof session !== 'object' || session.uid !== uid || !validLog(session.log) || session.storageReadFailed) {
    throw new Error('Draft session required');
  }
  storage.setItem(key(uid), JSON.stringify(normalizeDraft(session, uid)));
}

export function loadDraft(storage, uid) {
  return loadDraftSession(storage, uid)?.log || [];
}

export function saveDraft(storage, uid, log) {
  if (!Array.isArray(log)) throw new Error('Draft must be an array');
  storage.setItem(key(uid), JSON.stringify(log));
}

export function clearDraft(storage, uid) {
  if (uid) storage.removeItem(key(uid));
  storage.removeItem('gym_log_draft');
}

export function visibleDraft(draft, uid) {
  return uid && draft?.uid === uid && Array.isArray(draft.log) ? draft.log : [];
}

export function submissionDocumentId(selectedDate, sessionId) {
  if (!validDate(selectedDate) || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error('Submission date and session ID required');
  }
  // The editable date is payload, never part of one logical session's identity.
  return `session-${sessionId}`;
}

export function canClearDraftAfterSubmission(draft, uid, sessionId, revision) {
  return !!draft
    && draft.uid === uid
    && draft.sessionId === sessionId
    && draft.revision === revision;
}

function canonicalPayload(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalPayload).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(name => `${JSON.stringify(name)}:${canonicalPayload(value[name])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function submissionSafetyError(code, message, userMessage) {
  return Object.assign(new Error(message), { code, userMessage });
}

const identityError = () => submissionSafetyError('submission-identity-unknown',
  'Prior submission identity cannot be proven; draft retained',
  '這份草稿的先前提交識別尚未確認；內容已保留，暫停送出，請先核對既有訓練紀錄。');

// readServer must use getDocsFromServer on this UID's LogDB, filtered by
// submissionId, with no limit/cache fallback. The editable date cannot locate an
// older date-keyed document. Old drafts with no match remain ambiguous: never
// infer a safe new identity from an empty lookup or a regenerated session ID.
export async function discoverDraftSubmission(readServer, selectedDate, payload, identity) {
  const canonicalId = submissionDocumentId(selectedDate, payload.submissionId);
  if (!['session', 'legacy-session'].includes(identity)) throw identityError();
  const records = await readServer();
  if (!Array.isArray(records)) throw identityError();
  if (records.length > 1) {
    throw submissionSafetyError('submission-identity-conflict', 'Multiple submission identities conflict; draft retained',
      '此訓練工作階段找到多筆既有紀錄；草稿已保留，未新增或合併紀錄，請先核對既有訓練紀錄。');
  }
  if (records.length === 0) {
    if (identity !== 'session') throw identityError();
    return { documentId: canonicalId, kind: 'canonical', mustExist: false };
  }
  const record = records[0];
  if (!record.data || record.data.userId !== payload.userId || record.data.submissionId !== payload.submissionId) {
    throw identityError();
  }
  if (record.id === canonicalId) return { documentId: canonicalId, kind: 'canonical', mustExist: true };
  const suffix = `-${payload.submissionId}`;
  if (typeof record.id === 'string' && record.id.endsWith(suffix)
    && validDate(record.id.slice(0, -suffix.length))) {
    return { documentId: record.id, kind: 'legacy', mustExist: true };
  }
  throw identityError();
}

// Called inside a Firestore transaction: every retry reads server state first.
// Equal revisions reconcile only identical payloads; older revisions never write.
export async function reconcileDraftSubmission(transaction, reference, payload, selection = { kind: 'canonical', mustExist: false }) {
  if (!['canonical', 'legacy'].includes(selection.kind)) throw identityError();
  if (!Number.isSafeInteger(payload.submissionRevision) || payload.submissionRevision < 0) {
    throw new Error('Submission revision required');
  }
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists() && (selection.mustExist || selection.kind === 'legacy')) {
    throw submissionSafetyError('submission-identity-disappeared', 'Discovered submission identity disappeared; draft retained',
      '先前找到的提交紀錄目前無法確認；草稿已保留，未建立新紀錄，請先核對既有訓練紀錄。');
  }
  if (snapshot.exists()) {
    const existing = snapshot.data();
    if (existing.userId !== payload.userId || existing.submissionId !== payload.submissionId) {
      throw new Error('Submission identity conflict');
    }
    if (selection.kind === 'legacy') {
      const { submissionRevision: storedRevision, ...storedContent } = existing;
      const { submissionRevision: incomingRevision, ...incomingContent } = payload;
      if (storedRevision !== undefined && (!Number.isSafeInteger(storedRevision) || storedRevision < 0 || storedRevision > incomingRevision)) {
        throw submissionSafetyError('submission-stale-revision', 'A newer or incompatible legacy revision exists; draft retained',
          '既有提交含較新或無法確認的版本；草稿已保留，未覆寫或新增紀錄，請先核對既有訓練紀錄。');
      }
      if (canonicalPayload(storedContent) !== canonicalPayload(incomingContent)) {
        throw submissionSafetyError('legacy-submission-conflict', 'Legacy submission payload differs; draft retained',
          '已找到舊版提交，但日期或內容與目前草稿不同；草稿已保留，未覆寫或新增紀錄，請先核對既有訓練紀錄。');
      }
      // Read-only acknowledgement: never backfill a revision, rename an ID or
      // overwrite a legacy payload whose submitted revision was not recorded.
      return 'legacy-reconciled';
    }
    if (!Number.isSafeInteger(existing.submissionRevision) || existing.submissionRevision < 0
      || existing.submissionRevision > payload.submissionRevision) {
      throw new Error('A newer or incompatible submission exists; draft retained');
    }
    if (existing.submissionRevision === payload.submissionRevision) {
      if (canonicalPayload(existing) !== canonicalPayload(payload)) {
        throw new Error('Concurrent submission conflict; draft retained');
      }
      return 'reconciled';
    }
  }
  transaction.set(reference, payload);
  return 'written';
}

// One editor owns the UID draft across tabs. Queued editors hydrate after acquiring
// the lock; closing/signing out releases it. Unsupported browsers fail closed.
export function holdDraftEditorLock(locks, uid, onAcquired) {
  key(uid);
  if (!locks?.request) throw new Error('This browser cannot safely coordinate draft tabs');
  let active = true;
  let releaseLock;
  const released = new Promise(resolve => { releaseLock = resolve; });
  const done = locks.request(`mgl-draft-editor:${uid}`, { mode: 'exclusive' }, async () => {
    if (!active) return;
    await onAcquired();
    await released;
  });
  return { done, release() { active = false; releaseLock(); } };
}
