import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduledWorker } from '../retention/src/index.js';
import { FIRST_DELETION_MS } from '../src/services/legacyMigrationPolicy.js';

test('Cron before Taipei deletion window makes no OAuth or Firestore call', async () => {
  let called = false;
  const worker = createScheduledWorker({ getToken: async () => { called = true; throw new Error('must_not_call'); } });
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS - 1 }, {});
  assert.equal(called, false);
});

test('upstream secret-bearing exception is not copied to Worker logs', async () => {
  const logged = [];
  const worker = createScheduledWorker({
    getToken: async () => { throw new Error('redaction-sentinel'); },
    logger: { error: (...args) => logged.push(args.join(' ')) },
  });
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS, cron: '15 * * * *' }, {});
  assert.equal(logged.length, 1);
  assert.equal(logged.join(' ').includes('redaction-sentinel'), false);
});

test('E2 and E3 have independent deletion windows and unknown Cron does nothing', async () => {
  const cohorts = [];
  const worker = createScheduledWorker({
    getToken: async () => 'fixture-token',
    makeApi: () => ({}),
    run: async (_api, _now, cohort) => { cohorts.push(cohort); },
  });
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS, cron: '15 * * * *' }, {});
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS + 15 * 60_000, cron: '30 * * * *' }, {});
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS, cron: '45 * * * *' }, {});
  assert.deepEqual(cohorts, ['E2', 'E3']);
});
