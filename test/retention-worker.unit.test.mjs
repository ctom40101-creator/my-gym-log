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
  await worker.scheduled({ scheduledTime: FIRST_DELETION_MS }, {});
  assert.equal(logged.length, 1);
  assert.equal(logged.join(' ').includes('redaction-sentinel'), false);
});
