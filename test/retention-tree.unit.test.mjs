import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletePrivateTree } from '../retention/src/firestoreTree.js';

const root = 'artifacts/demo/users/fixture-uid';

test('recursive cleanup deletes Settings and nested missing-parent descendants, never shared public data', async () => {
  const documents = new Set([
    `${root}/LogDB/log1`, `${root}/Settings/profile`,
    `${root}/LogDB/missing-parent/Nested/deep`,
    'artifacts/demo/public/data/MovementDB/shared',
  ]);
  const io = {
    documentExists: async path => documents.has(path),
    listCollections: async path => {
      if (path === root) return ['LogDB', 'Settings'];
      if (path === `${root}/LogDB/missing-parent`) return ['Nested'];
      return [];
    },
    listDocuments: async path => {
      if (path === `${root}/LogDB`) return [{ path: `${path}/log1`, exists: true }, { path: `${path}/missing-parent`, exists: false }];
      if (path === `${root}/LogDB/missing-parent/Nested`) return [{ path: `${path}/deep`, exists: true }];
      if (path === `${root}/Settings`) return [{ path: `${path}/profile`, exists: true }];
      return [];
    },
    deleteDocument: async path => { documents.delete(path); },
  };
  assert.deepEqual(await deletePrivateTree(root, io, 50), { complete: true, deleted: 3 });
  assert.deepEqual([...documents], ['artifacts/demo/public/data/MovementDB/shared']);
});

test('bounded partial deletion can restart and eventually finish', async () => {
  const documents = new Set([`${root}/LogDB/a`, `${root}/LogDB/b`, `${root}/LogDB/c`]);
  const io = {
    documentExists: async path => documents.has(path),
    listCollections: async path => path === root ? (documents.size ? ['LogDB'] : []) : [],
    listDocuments: async () => [...documents].map(path => ({ path, exists: true })),
    deleteDocument: async path => { documents.delete(path); },
  };
  let complete = false;
  for (let attempt = 0; attempt < 10 && !complete; attempt++) {
    const result = await deletePrivateTree(root, io, 4);
    complete = result.complete;
  }
  assert.equal(complete, true);
  assert.equal(documents.size, 0);
});
