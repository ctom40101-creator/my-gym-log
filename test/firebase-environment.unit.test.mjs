import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirebaseEnvironment } from '../src/firebaseEnvironment.js';

const configEnv = (appEnvironment, projectId) => ({
  VITE_APP_ENV: appEnvironment,
  VITE_EXPECTED_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.firebasestorage.app`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:test',
});

test('production config resolves only when the expected project matches', () => {
  const result = resolveFirebaseEnvironment(configEnv('production', 'mygymlog-604bc'));
  assert.equal(result.appEnvironment, 'production');
  assert.equal(result.firebaseConfig.projectId, 'mygymlog-604bc');
});

test('staging config resolves to the isolated staging project', () => {
  const result = resolveFirebaseEnvironment(configEnv('staging', 'mygymlog-604bc-staging'));
  assert.equal(result.appEnvironment, 'staging');
  assert.equal(result.firebaseConfig.projectId, 'mygymlog-604bc-staging');
});
test('project guard rejects a mismatched Firebase target', () => {
  const env = configEnv('staging', 'mygymlog-604bc-staging');
  env.VITE_FIREBASE_PROJECT_ID = 'mygymlog-604bc';
  assert.throws(() => resolveFirebaseEnvironment(env), /firebase_project_guard_mismatch/);
});

test('missing staging Firebase config fails closed', () => {
  const env = configEnv('staging', 'mygymlog-604bc-staging');
  delete env.VITE_FIREBASE_API_KEY;
  assert.throws(() => resolveFirebaseEnvironment(env), /firebase_config_missing:VITE_FIREBASE_API_KEY/);
});

test('unknown application environments fail closed', () => {
  const env = configEnv('preview', 'mygymlog-604bc-staging');
  assert.throws(() => resolveFirebaseEnvironment(env), /firebase_environment_invalid/);
});
