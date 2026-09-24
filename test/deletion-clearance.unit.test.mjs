import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectDeletionCandidate, issueDeletionClearance } from '../tools/deletion-clearance/verify.js';

const projectId = 'demo-mygym-security-v1';
const uid = 'member-uid';
const email = 'member@example.test';

function fixture({ requestStatus = 'disabled', deletionMarker = true, indexExists = false, rootExists = false, collectionIds = [], existingClearance = null, requestEmail = email } = {}) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method || 'GET', body: init.body && JSON.parse(init.body), authorization: init.headers?.Authorization });
    if (url.endsWith('/AccessRequests/member-uid')) return Response.json({
      updateTime: '2026-09-24T00:00:00Z', fields: {
        uid: { stringValue: uid }, email: { stringValue: requestEmail }, status: { stringValue: requestStatus },
        ...(deletionMarker ? { deletionStartedAt: { timestampValue: '2026-09-24T00:00:00Z' } } : {}),
      },
    });
    if (url.endsWith('/UserIndex/member-uid')) return indexExists ? Response.json({ name: url }) : Response.json({}, { status: 404 });
    if (url.endsWith('/users/member-uid')) return rootExists ? Response.json({ name: url }) : Response.json({}, { status: 404 });
    if (url.endsWith('/users/member-uid:listCollectionIds')) return Response.json({ collectionIds });
    if (url.includes('/DeletionClearances/member-uid?') && init.method === 'PATCH') return Response.json({ name: url });
    if (url.endsWith('/DeletionClearances/member-uid')) return existingClearance ? Response.json(existingClearance) : Response.json({}, { status: 404 });
    throw new Error('Unexpected request');
  };
  return { calls, fetchImpl };
}

test('read-only inventory proves empty root, index, and all subcollections before clearance', async () => {
  const f = fixture();
  const proof = await inspectDeletionCandidate({ projectId, uid, email, token: 'test-token', fetchImpl: f.fetchImpl });
  assert.equal(proof.requestUpdateTime, '2026-09-24T00:00:00Z');
  assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
  assert.equal(f.calls.find(call => call.url.endsWith(':listCollectionIds')).authorization, 'Bearer test-token');
});

test('any residual collection, index, root, or request mismatch prevents clearance write', async () => {
  for (const state of [
    { collectionIds: ['Unexpected'] }, { indexExists: true }, { rootExists: true },
    { requestStatus: 'approved' }, { requestEmail: 'different@example.test' }, { deletionMarker: false },
  ]) {
    const f = fixture(state);
    await assert.rejects(issueDeletionClearance({ projectId, uid, email, token: 'test-token', fetchImpl: f.fetchImpl, commit: true }));
    assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
  }
});

test('privileged clearance write is explicit and bound to the request update time', async () => {
  const f = fixture();
  const result = await issueDeletionClearance({ projectId, uid, email, token: 'test-token', fetchImpl: f.fetchImpl, commit: true });
  assert.equal(result.issued, true);
  const write = f.calls.find(call => call.method === 'PATCH');
  assert.match(write.url, /currentDocument\.exists=false/);
  assert.equal(write.body.fields.requestUpdateTime.stringValue, '2026-09-24T00:00:00Z');
  assert.equal(write.body.fields.uid.stringValue, uid);
  assert.equal(write.body.fields.email.stringValue, email);
});

test('existing clearance cannot be silently replaced', async () => {
  const f = fixture({ existingClearance: { fields: { requestUpdateTime: { stringValue: 'stale' } } } });
  await assert.rejects(issueDeletionClearance({ projectId, uid, email, token: 'test-token', fetchImpl: f.fetchImpl, commit: true }));
  assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
});
