import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stagedDeleteUser, finalizeDeleteUser, stagedSelfDelete, finalizeSelfDelete } from '../src/services/accountDeletion.js';

test('admin deletion stages disabled status, Auth disable, and data cleanup before human inventory', async () => {
  const calls = [];
  const ops = Object.fromEntries(['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteRoot', 'deleteIndex', 'deleteRequest', 'deleteAuth']
    .map(name => [name, async () => { calls.push(name); }]));
  await stagedDeleteUser('member-uid', ops);
  assert.deepEqual(calls, ['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteRoot', 'deleteIndex']);
});

test('admin finalization deletes Auth and request only after Worker accepts clearance', async () => {
  const calls = [];
  await finalizeDeleteUser('member-uid', {
    deleteAuth: async () => calls.push('deleteAuth'),
    deleteMetadata: async () => calls.push('deleteMetadata'),
  });
  assert.deepEqual(calls, ['deleteAuth', 'deleteMetadata']);
});

test('failed cleanup cannot reach permanent Auth deletion', async () => {
  const calls = [];
  const ops = Object.fromEntries(['markDisabled', 'disableAuth', 'deletePrivateData', 'deleteRoot', 'deleteIndex', 'deleteRequest', 'deleteAuth']
    .map(name => [name, async () => { calls.push(name); if (name === 'deletePrivateData') throw new Error('cleanup failed'); }]));
  await assert.rejects(stagedDeleteUser('member-uid', ops));
  assert.deepEqual(calls, ['markDisabled', 'disableAuth', 'deletePrivateData']);
});

test('invalid UID cannot enter staged deletion', async () => {
  await assert.rejects(stagedDeleteUser('../owner', {}));
});

test('self deletion locks access and leaves data cleanup to the Admin', async () => {
  const calls = [];
  const ops = Object.fromEntries(['reauthenticate', 'deletePrivateData', 'deleteRoot', 'deleteIndex', 'revokeAccess', 'deleteAuth']
    .map(name => [name, async () => calls.push(name)]));
  await stagedSelfDelete(ops);
  assert.deepEqual(calls, ['reauthenticate', 'revokeAccess']);
});

test('self finalization requires fresh reauthentication before Worker Auth delete', async () => {
  const calls = [];
  await finalizeSelfDelete({
    reauthenticate: async () => calls.push('reauthenticate'),
    deleteAuth: async () => calls.push('deleteAuth'),
  });
  assert.deepEqual(calls, ['reauthenticate', 'deleteAuth']);
});

test('self deletion cannot delete Auth if access revocation fails', async () => {
  const calls = [];
  const ops = Object.fromEntries(['reauthenticate', 'deletePrivateData', 'deleteRoot', 'deleteIndex', 'revokeAccess', 'deleteAuth']
    .map(name => [name, async () => { calls.push(name); if (name === 'revokeAccess') throw new Error('failed'); }]));
  await assert.rejects(stagedSelfDelete(ops));
  assert.deepEqual(calls, ['reauthenticate', 'revokeAccess']);
});
