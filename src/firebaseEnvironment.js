const REQUIRED_CONFIG = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
];

const value = (env, key) => String(env?.[key] ?? '').trim();

export function resolveFirebaseEnvironment(env = {}) {
  const appEnvironment = value(env, 'VITE_APP_ENV');
  if (!['production', 'staging'].includes(appEnvironment)) {
    throw new Error('firebase_environment_invalid');
  }

  const expectedProjectId = value(env, 'VITE_EXPECTED_FIREBASE_PROJECT_ID');
  if (!expectedProjectId) throw new Error('firebase_expected_project_missing');

  const firebaseConfig = {};
  for (const [field, key] of REQUIRED_CONFIG) {
    const resolved = value(env, key);
    if (!resolved) throw new Error(`firebase_config_missing:${key}`);
    firebaseConfig[field] = resolved;
  }

  const measurementId = value(env, 'VITE_FIREBASE_MEASUREMENT_ID');
  if (measurementId) firebaseConfig.measurementId = measurementId;

  if (firebaseConfig.projectId !== expectedProjectId) {
    throw new Error('firebase_project_guard_mismatch');
  }

  return { appEnvironment, expectedProjectId, firebaseConfig };
}
