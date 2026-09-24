function key(uid) {
  if (typeof uid !== 'string' || !uid) throw new Error('Firebase UID required');
  return `gym_log_draft:${uid}`;
}

export function loadDraft(storage, uid) {
  if (!uid) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key(uid)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
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
  return uid && draft.uid === uid && Array.isArray(draft.log) ? draft.log : [];
}
