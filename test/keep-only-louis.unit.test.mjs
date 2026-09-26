import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLegacyTargetPolicy, evaluateDeletion, FIRST_DELETION_MS } from '../src/services/legacyMigrationPolicy.js';
import { createRetentionApi } from '../retention/src/api.js';
import { createScheduledWorker } from '../retention/src/index.js';

const uid = 'protected-fixture-uid';
const cohort = 'LEGACY_MIGRATION_KEEP_01';
const policy = { program: 'LEGACY_ACCOUNT_SUNSET_2026', cohort, originalUid: uid,
  deadlineAt: '2026-12-31T15:59:59Z', state: 'LEGACY_PASSWORD_PENDING', deletionHold: false };
const response = body => new Response(JSON.stringify(body), { status: 200 });

test('only protected cohort is eligible for same-UID migration and delayed retention', () => {
  assert.equal(isLegacyTargetPolicy(policy, uid, 'owner-uid'), true);
  assert.equal(isLegacyTargetPolicy({ ...policy, cohort: 'E2' }, uid, 'owner-uid'), false);
  assert.equal(isLegacyTargetPolicy({ ...policy, cohort: 'E3' }, uid, 'owner-uid'), false);
  assert.equal(isLegacyTargetPolicy(policy, uid, uid), false);
  const auth = { localId: uid, providerUserInfo: [{ providerId: 'password' }] };
  assert.equal(evaluateDeletion({ policy, auth, uid, ownerUid: 'owner-uid', now: FIRST_DELETION_MS }).eligible, true);
  assert.equal(evaluateDeletion({ policy, auth: { ...auth, providerUserInfo: [...auth.providerUserInfo, { providerId: 'google.com' }] },
    uid, ownerUid: 'owner-uid', now: FIRST_DELETION_MS }).eligible, false);
});

test('retention roster requires exactly one protected policy and rejects extras', async () => {
  const row = { name: `projects/demo-project/databases/(default)/documents/MigrationPolicies/${uid}`,
    updateTime: '2026-09-26T00:00:00Z', fields: {
      program: { stringValue: policy.program }, cohort: { stringValue: cohort },
      originalUid: { stringValue: uid }, deadlineAt: { stringValue: policy.deadlineAt },
      state: { stringValue: policy.state }, deletionHold: { booleanValue: false },
    } };
  const config = { FIREBASE_PROJECT_ID: 'demo-project', APP_ID: 'demo-project' };
  const single = createRetentionApi(config, 'fixture-token', async () => response({ documents: [row] }));
  assert.equal((await single.listTargets()).length, 1);
  const extra = createRetentionApi(config, 'fixture-token', async () => response({ documents: [row, { ...row, name: row.name + '-extra' }] }));
  await assert.rejects(extra.listTargets(), /roster_ambiguous/);
});

test('only one hourly UTC :15 Cron invokes protected cohort', async () => {
  const called = [];
  const worker = createScheduledWorker({ getToken: async () => 'fixture-token', makeApi: () => ({}),
    run: async (_api, _time, selected) => called.push(selected) });
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS, cron: '15 * * * *' }, {});
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS + 15 * 60_000, cron: '30 * * * *' }, {});
  assert.deepEqual(called, [cohort]);
  const config = JSON.parse(readFileSync(new URL('../retention/wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(config.triggers.crons, ['15 * * * *']);
  assert.equal(config.workers_dev, false);
});
