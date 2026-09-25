import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRetentionApi } from '../retention/src/api.js';

const config = { FIREBASE_PROJECT_ID: 'demo-project', APP_ID: 'demo-project' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('Auth lookup rejects absent provider inventory and wrong UID', async () => {
  const requests = [];
  const api = createRetentionApi(config, 'fixture-token', async (url, init) => {
    requests.push({ url, init });
    return response({ users: [{ localId: 'fixture-uid', email: 'fixture@example.test', disabled: false }] });
  });
  await assert.rejects(api.getAuth('fixture-uid'), /auth_provider_ambiguous/);
  assert.match(requests[0].url, /accounts:lookup$/);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer fixture-token');
  const bad = createRetentionApi(config, 'fixture-token', async () => response({ users: [{ localId: 'different' }] }));
  await assert.rejects(bad.getAuth('fixture-uid'), /auth_identity_mismatch/);
});

test('Auth lookup accepts an explicit empty provider inventory', async () => {
  const api = createRetentionApi(config, 'fixture-token', async () => response({ users: [
    { localId: 'fixture-uid', email: 'fixture@example.test', providerUserInfo: [] },
  ] }));
  assert.deepEqual((await api.getAuth('fixture-uid')).providerUserInfo, []);
});

test('Auth lookup rejects malformed provider rows', async () => {
  const api = createRetentionApi(config, 'fixture-token', async () => response({ users: [
    { localId: 'fixture-uid', email: 'fixture@example.test', providerUserInfo: [{}] },
  ] }));
  await assert.rejects(api.getAuth('fixture-uid'), /auth_provider_ambiguous/);
});

test('roster requires exactly E2 and E3 and never contains public source identities', async () => {
  const rows = ['E2', 'E3'].map((cohort, index) => ({
    name: `projects/demo-project/databases/(default)/documents/MigrationPolicies/fixture-${index}`,
    updateTime: '2026-09-25T00:00:00Z',
    fields: { program: { stringValue: 'LEGACY_ACCOUNT_SUNSET_2026' }, cohort: { stringValue: cohort },
      originalUid: { stringValue: `fixture-${index}` }, deadlineAt: { stringValue: '2026-12-31T15:59:59Z' },
      state: { stringValue: 'LEGACY_PASSWORD_PENDING' }, deletionHold: { booleanValue: false } },
  }));
  const api = createRetentionApi(config, 'fixture-token', async () => response({ documents: rows }));
  assert.equal((await api.listTargets()).length, 2);
  const extra = createRetentionApi(config, 'fixture-token', async () => response({ documents: [...rows, rows[0]] }));
  await assert.rejects(extra.listTargets(), /roster_ambiguous/);
});

test('failed Firestore compare-and-swap returns lock lost without deleting anything', async () => {
  const calls = [];
  const api = createRetentionApi(config, 'fixture-token', async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/MigrationPolicies/fixture-uid')) return response({ fields: {
      state: { stringValue: 'LEGACY_PASSWORD_PENDING' }, deletionHold: { booleanValue: false },
    }, updateTime: '2026-09-25T00:00:00Z' });
    if (url.endsWith('documents:commit')) return response({ error: 'precondition' }, 409);
    throw new Error('unexpected_url');
  });
  assert.equal(await api.acquireLock('fixture-uid', '2026-09-25T00:00:00Z', Date.parse('2027-01-01T00:00:00Z')), null);
  assert.equal(calls.filter(call => call.init?.method === 'DELETE').length, 0);
});

test('Firestore delete accepts an empty successful response', async () => {
  const api = createRetentionApi(config, 'fixture-token', async (url) => {
    if (url.endsWith('accounts:lookup')) return response({ users: [{
      localId: 'fixture-uid', email: 'fixture@example.test', providerUserInfo: [], disabled: true,
    }] });
    if (url.endsWith('/MigrationPolicies/fixture-uid')) return response({ fields: {
      state: { stringValue: 'DELETION_IN_PROGRESS' }, lockId: { stringValue: 'fixture-lock' },
      deletionHold: { booleanValue: false }, lockExpiresAt: { timestampValue: '2099-01-01T00:00:00Z' },
    } });
    return new Response(null, { status: 204 });
  });
  await assert.doesNotReject(api.deleteIndex('fixture-uid', 'fixture-lock'));
});

test('private Firestore paths encode special document IDs before requests', async () => {
  const urls = [];
  const root = 'artifacts/demo-project/users/fixture-uid';
  const special = `${root}/LogDB/note#50%?`;
  let deleted = false;
  const api = createRetentionApi(config, 'fixture-token', async (url, init) => {
    urls.push(url);
    if (url.endsWith('accounts:lookup')) return response({ users: [{
      localId: 'fixture-uid', email: 'fixture@example.test', providerUserInfo: [], disabled: true,
    }] });
    if (url.endsWith('/MigrationPolicies/fixture-uid')) return response({ fields: {
      state: { stringValue: 'DELETION_IN_PROGRESS' }, lockId: { stringValue: 'fixture-lock' },
      deletionHold: { booleanValue: false }, lockExpiresAt: { timestampValue: '2099-01-01T00:00:00Z' },
    } });
    if (url.endsWith('/RetentionJobs/fixture-uid') && init?.method !== 'DELETE') return response({}, 404);
    if (url.includes(':listCollectionIds')) return response({ collectionIds: deleted || url.includes('note') ? [] : ['LogDB'] });
    if (url.includes('showMissing=true')) return response({ documents: [{
      name: `projects/demo-project/databases/(default)/documents/${special}`,
      updateTime: '2026-01-01T00:00:00Z',
    }] });
    if (url.endsWith(`/${root}`) && init?.method !== 'DELETE') return response({}, 404);
    if (init?.method === 'DELETE') deleted = true;
    return response({});
  });
  const complete = await api.deletePrivateRecursively('fixture-uid', 'fixture-lock');
  assert.equal(complete.complete, true);
  assert.ok(urls.some(url => url.includes('note%2350%25%3F')));
  assert.ok(urls.every(url => !url.includes('#')));
});

test('retention cursor is persisted under admin-only job path for the next Cron', async () => {
  const calls = [];
  const api = createRetentionApi(config, 'fixture-token', async (url, init) => {
    calls.push({ url, init });
    if (init?.method === 'PATCH') return response({});
    return response({}, 404);
  });
  assert.equal(await api.loadCursor('fixture-uid'), 'artifacts/demo-project/users/fixture-uid');
  await api.saveCursor('fixture-uid', 'artifacts/demo-project/users/fixture-uid/LogDB/deep');
  assert.ok(calls.some(call => call.url.includes('/RetentionJobs/fixture-uid') && call.init?.method === 'PATCH'));
  assert.ok(calls.every(call => !call.url.includes('MovementDB')));
});

test('an empty Firestore page with a continuation token cannot prove cleanup', async () => {
  const root = 'artifacts/demo-project/users/fixture-uid';
  const api = createRetentionApi(config, 'fixture-token', async url => {
    if (url.includes(':listCollectionIds')) return response({ collectionIds: [], nextPageToken: 'next' });
    if (url.endsWith(`/${root}`)) return response({}, 404);
    return response({});
  });
  await assert.rejects(api.verifyPrivateRootEmpty('fixture-uid'), /collection_inventory_ambiguous/);
});

test('an empty document page with a continuation token cannot let tree delete its parent', async () => {
  const root = 'artifacts/demo-project/users/fixture-uid';
  const api = createRetentionApi(config, 'fixture-token', async url => {
    if (url.endsWith('/RetentionJobs/fixture-uid')) return response({}, 404);
    if (url.includes(':listCollectionIds')) return response({ collectionIds: ['LogDB'] });
    if (url.includes('showMissing=true')) return response({ documents: [], nextPageToken: 'next' });
    if (url.endsWith(`/${root}`)) return response({ name: root });
    return response({});
  });
  await assert.rejects(api.deletePrivateRecursively('fixture-uid', 'fixture-lock'), /document_inventory_ambiguous/);
});

test('Google linkage vetoes UserIndex and AccessRequest deletion before each request', async () => {
  for (const method of ['deleteIndex', 'deleteAccessRequest']) {
    const calls = [];
    const api = createRetentionApi(config, 'fixture-token', async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/MigrationPolicies/fixture-uid')) return response({ fields: {
        state: { stringValue: 'DELETION_IN_PROGRESS' }, lockId: { stringValue: 'fixture-lock' },
        deletionHold: { booleanValue: false }, lockExpiresAt: { timestampValue: '2099-01-01T00:00:00Z' },
      } });
      if (url.endsWith('accounts:lookup')) return response({ users: [{
        localId: 'fixture-uid', email: 'fixture@example.test', disabled: true,
        providerUserInfo: [{ providerId: 'google.com' }],
      }] });
      throw new Error('unexpected_url');
    });
    await assert.rejects(api[method]('fixture-uid', 'fixture-lock'), /google_linked_during_cleanup/);
    assert.equal(calls.some(call => call.init?.method === 'DELETE'), false);
  }
});
