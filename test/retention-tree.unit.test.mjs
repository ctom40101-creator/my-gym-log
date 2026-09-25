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
    listCollections: async path => [...new Set([...documents]
      .filter(item => item.startsWith(`${path}/`))
      .map(item => item.slice(path.length + 1).split('/')[0]))],
    listDocuments: async path => [...new Set([...documents]
      .filter(item => item.startsWith(`${path}/`))
      .map(item => `${path}/${item.slice(path.length + 1).split('/')[0]}`))]
      .map(item => ({ path: item, exists: documents.has(item) })),
    deleteDocument: async path => { documents.delete(path); },
  };
  const result = await deletePrivateTree(root, io, 50);
  assert.equal(result.complete, true);
  assert.equal(result.deleted, 3);
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
  let cursor = root;
  for (let attempt = 0; attempt < 10 && !complete; attempt++) {
    const result = await deletePrivateTree(root, io, 4, cursor);
    complete = result.complete;
    cursor = result.cursor;
  }
  assert.equal(complete, true);
  assert.equal(documents.size, 0);
});

test('persisted cursor reaches and removes a deeply nested leaf across bounded Cron runs', async () => {
  const path = [root];
  for (let level = 0; level < 30; level++) path.push(`${path.at(-1)}/C${level}/d${level}`);
  let leafExists = true;
  const io = {
    documentExists: async current => current === path.at(-1) && leafExists,
    listCollections: async current => {
      const level = path.indexOf(current);
      return leafExists && level >= 0 && level < path.length - 1 ? [`C${level}`] : [];
    },
    listDocuments: async collectionPath => {
      const level = path.findIndex(current => collectionPath === `${current}/C${path.indexOf(current)}`);
      return leafExists && level >= 0 && level < path.length - 1
        ? [{ path: path[level + 1], exists: level + 1 === path.length - 1 }] : [];
    },
    deleteDocument: async current => { assert.equal(current, path.at(-1)); leafExists = false; },
  };
  let cursor = root;
  let complete = false;
  for (let run = 0; run < 100 && !complete; run++) {
    const result = await deletePrivateTree(root, io, 6, cursor);
    cursor = result.cursor;
    complete = result.complete;
  }
  assert.equal(complete, true);
  assert.equal(leafExists, false);
});
