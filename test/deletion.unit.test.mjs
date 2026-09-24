import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagedDeleteUser } from '../src/services/accountDeletion.js';

test('admin deletion stages disabled status, Auth disable, data cleanup, then Auth delete', async () => {
  const calls = [];
  const ops = Object.fromEntries(['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteIndex', 'deleteRequest', 'deleteAuth']
    .map(name => [name, async () => { calls.push(name); }]));
  await stagedDeleteUser('member-uid', ops);
  assert.deepEqual(calls, ['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteIndex', 'deleteAuth', 'deleteRequest']);
});

test('failed cleanup cannot reach permanent Auth deletion', async () => {
  const calls = [];
  const ops = Object.fromEntries(['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteIndex', 'deleteRequest', 'deleteAuth']
    .map(name => [name, async () => { calls.push(name); if (name === 'deletePrivateData') throw new Error('cleanup failed'); }]));
  await assert.rejects(stagedDeleteUser('member-uid', ops));
  assert.deepEqual(calls, ['markDisabled', 'disableAuth', 'deletePrivateData']);
});

test('invalid UID cannot enter staged deletion', async () => {
  await assert.rejects(stagedDeleteUser('../owner', {}));
});
