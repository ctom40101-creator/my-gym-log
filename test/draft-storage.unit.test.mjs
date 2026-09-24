import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, loadDraft, saveDraft, visibleDraft } from '../src/services/draftStorage.js';

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
  local.setItem('gym_log_draft', JSON.stringify([{ movementName: 'legacy' }]));
  assert.deepEqual(loadDraft(local, 'member-a'), []);
  saveDraft(local, 'member-a', [{ movementName: 'private-a' }]);
  assert.deepEqual(loadDraft(local, 'member-a'), [{ movementName: 'private-a' }]);
  assert.deepEqual(loadDraft(local, 'member-b'), []);
  assert.deepEqual(visibleDraft({ uid: 'member-a', log: [{ movementName: 'private-a' }] }, 'member-b'), []);
});

test('deletion clears both scoped and legacy browser drafts', () => {
  const local = storage();
  local.setItem('gym_log_draft', 'legacy');
  saveDraft(local, 'member-a', [{ movementName: 'private-a' }]);
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
