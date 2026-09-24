import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataViewMode } from '../src/services/dataViewMode.js';

test('switching users blocks rendering until every snapshot belongs to the target UID', () => {
  assert.equal(dataViewMode('member-b', 'member-a', 'owner-uid'), 'loading');
  assert.equal(dataViewMode('member-b', 'member-b', 'owner-uid'), 'read_only');
});

test('own account remains editable only after its snapshots load', () => {
  assert.equal(dataViewMode('owner-uid', null, 'owner-uid'), 'loading');
  assert.equal(dataViewMode('owner-uid', 'owner-uid', 'owner-uid'), 'editable');
});
