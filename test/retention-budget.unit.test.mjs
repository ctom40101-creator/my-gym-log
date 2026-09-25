import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRetentionApi } from '../retention/src/api.js';
import { runRetention } from '../retention/src/retention.js';
import { FIRST_DELETION_MS } from '../src/services/legacyMigrationPolicy.js';

const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });
const project = 'demo-project';
const base = `projects/${project}/databases/(default)/documents`;
const privateRoot = 'artifacts/demo-project/users/fixture-e2';

test('full successful retention pass remains below Workers Free subrequest ceiling', async () => {
  let calls = 0;
  let state = 'LEGACY_PASSWORD_PENDING';
  let lockId;
  let updateTime = '2026-09-25T00:00:00Z';
  let disabled = false;
  let authExists = true;
  let privateExists = true;
  let receiptExists = false;
  const policy = (uid, cohort, stateValue = state) => ({
    name: `${base}/MigrationPolicies/${uid}`, updateTime,
    fields: { program: { stringValue: 'LEGACY_ACCOUNT_SUNSET_2026' },
      cohort: { stringValue: cohort }, originalUid: { stringValue: uid },
      deadlineAt: { stringValue: '2026-12-31T15:59:59Z' },
      state: { stringValue: stateValue }, deletionHold: { booleanValue: false },
      ...(lockId ? { lockId: { stringValue: lockId },
        lockExpiresAt: { timestampValue: '2027-01-01T01:00:00Z' } } : {}) },
  });
  const fetchImpl = async (input, init = {}) => {
    calls++;
    const url = String(input);
    if (url.endsWith('/SecurityConfig/owner')) return ok({ fields: { uid: { stringValue: 'owner-uid' } } });
    if (url.includes('/MigrationPolicies?pageSize=')) return ok({ documents: [
      policy('fixture-e2', 'E2'), policy('fixture-e3', 'E3', 'DELETION_HOLD'),
    ] });
    if (url.endsWith('/MigrationPolicies/fixture-e2')) return ok(policy('fixture-e2', 'E2'));
    if (url.endsWith('documents:commit')) {
      const write = JSON.parse(init.body).writes[0];
      if (write.update.fields.state) state = write.update.fields.state.stringValue;
      if (write.update.fields.lockId) lockId = write.update.fields.lockId.stringValue;
      updateTime = '2026-09-25T00:00:01Z';
      return ok({ writeResults: [{}] });
    }
    if (url.endsWith('accounts:lookup')) return ok(authExists ? { users: [{
      localId: 'fixture-e2', email: 'fixture@example.test', providerUserInfo: [], disabled,
    }] } : {});
    if (url.endsWith('accounts:update')) { disabled = JSON.parse(init.body).disableUser; return ok({}); }
    if (url.endsWith('accounts:delete')) { authExists = false; return ok({}); }
    if (url.endsWith('/RetentionJobs/fixture-e2')) return ok({}, 404);
    if (url.includes(':listCollectionIds')) return ok({ collectionIds:
      url.endsWith(`${privateRoot}:listCollectionIds`) && privateExists ? ['LogDB'] : [],
    });
    if (url.includes(`${privateRoot}/LogDB?`)) return ok({ documents: privateExists ? [{
      name: `${base}/${privateRoot}/LogDB/log`, updateTime,
    }] : [] });
    if (url.endsWith(`/${privateRoot}/LogDB/log`)) {
      if (init.method === 'DELETE') { privateExists = false; return ok({}); }
      return ok({ name: `${base}/${privateRoot}/LogDB/log`, updateTime });
    }
    if (url.endsWith(`/${privateRoot}`)) return ok({}, 404);
    if (url.endsWith('/DeletionReceipts/fixture-e2')) return ok(receiptExists ? { fields: {
      program: { stringValue: 'LEGACY_ACCOUNT_SUNSET_2026' }, cohort: { stringValue: 'E2' },
    } } : {}, receiptExists ? 200 : 404);
    if (url.includes('/DeletionReceipts/fixture-e2?') && init.method === 'PATCH') {
      receiptExists = true; return ok({});
    }
    if (init.method === 'DELETE') return ok({}, 404);
    throw new Error('unexpected_fixture_request');
  };
  const api = createRetentionApi({ FIREBASE_PROJECT_ID: project, APP_ID: project }, 'fixture-token', fetchImpl);
  const result = await runRetention(api, FIRST_DELETION_MS);
  assert.equal(result.deleted, 1);
  assert.equal(privateExists, false);
  assert.equal(authExists, false);
  assert.ok(calls <= 48, `Google API subrequests exceeded reserve: ${calls}`);
});
