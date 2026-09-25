import { importPKCS8, SignJWT } from 'jose';
import { FIRST_DELETION_MS } from '../../src/services/legacyMigrationPolicy.js';
import { createRetentionApi } from './api.js';
import { runRetention } from './retention.js';

const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore';

export async function serviceAccountToken(env, fetchImpl = fetch) {
  const account = JSON.parse(env.SERVICE_ACCOUNT_JSON || 'null');
  if (account?.type !== 'service_account' || account.project_id !== env.FIREBASE_PROJECT_ID
    || !account.client_email || !account.private_key) throw new Error('retention_credential_invalid');
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPES })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email).setSubject(account.client_email)
    .setAudience(OAUTH_URL).setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const response = await fetchImpl(OAUTH_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!response.ok) throw new Error('retention_oauth_failed');
  const payload = await response.json();
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('retention_oauth_invalid');
  return payload.access_token;
}

export function createScheduledWorker({ getToken = serviceAccountToken, makeApi = createRetentionApi,
  logger = console, fetchImpl = fetch } = {}) {
  return {
    async fetch() { return new Response('Not found', { status: 404 }); },
    async scheduled(controller, env) {
      try {
        const now = controller?.scheduledTime;
        if (!Number.isFinite(now)) throw new Error('scheduled_time_invalid');
        if (now < FIRST_DELETION_MS) return;
        const token = await getToken(env, fetchImpl);
        const api = makeApi(env, token, fetchImpl);
        await runRetention(api, now);
      } catch {
        logger.error('retention_failed');
      }
    },
  };
}

export default createScheduledWorker();
