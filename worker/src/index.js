import { decodeProtectedHeader, importPKCS8, importX509, jwtVerify, SignJWT } from 'jose';

const OWNER_EMAIL = 'ctom40101@gmail.com';
const TOKEN_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const AUTH_API = 'https://identitytoolkit.googleapis.com/v1/projects';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';
const MAX_BODY_BYTES = 1024;

function response(status, code, origin) {
  return Response.json({ code }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

function certificateResolver(fetchImpl) {
  let certificates = null;
  let expiresAt = 0;
  return async ({ kid }) => {
    if (!kid || !/^[A-Za-z0-9_-]{1,128}$/.test(kid)) throw new Error('Invalid key ID');
    if (!certificates || Date.now() >= expiresAt) {
      const result = await fetchImpl(TOKEN_CERTS_URL);
      if (!result.ok) throw new Error('Certificate endpoint unavailable');
      const next = await result.json();
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Invalid certificates');
      const maxAge = Number(result.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
      certificates = next;
      expiresAt = Date.now() + Math.min(Math.max(maxAge, 60), 3600) * 1000;
    }
    const certificate = certificates[kid];
    if (!certificate) throw new Error('Unknown key ID');
    return importX509(certificate, 'RS256');
  };
}

export async function verifyFirebaseToken(token, projectId, { resolveKey } = {}) {
  if (!projectId || typeof token !== 'string' || token.length > 8192) throw new Error('Invalid token');
  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token header');
  if (!resolveKey) throw new Error('Missing key resolver');
  const key = await resolveKey(header);
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    clockTolerance: '60s',
  });
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('Invalid subject');
  if (typeof payload.auth_time !== 'number' || payload.auth_time <= 0 || payload.auth_time > now + 60) throw new Error('Invalid auth time');
  return payload;
}

async function serviceAccountToken(env, fetchImpl) {
  const account = JSON.parse(env.SERVICE_ACCOUNT_JSON || 'null');
  if (account?.type !== 'service_account' || account.project_id !== env.FIREBASE_PROJECT_ID ||
      !account.client_email || !account.private_key) throw new Error('Invalid service account binding');
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: AUTH_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(OAUTH_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const result = await fetchImpl(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!result.ok) throw new Error('OAuth exchange failed');
  const payload = await result.json();
  if (!payload?.access_token) throw new Error('OAuth token missing');
  return payload.access_token;
}

async function authApi(fetchImpl, projectId, token, operation, body) {
  const result = await fetchImpl(`${AUTH_API}/${encodeURIComponent(projectId)}/accounts:${operation}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!result.ok) throw new Error(`Auth API ${operation} failed`);
  return result.json();
}

function singleUser(users, expectedUid) {
  if (!Array.isArray(users) || users.length !== 1 || users[0]?.localId !== expectedUid) return null;
  return users[0];
}

export function createWorker({ fetchImpl = fetch, resolveKey } = {}) {
  const keyResolver = resolveKey || certificateResolver(fetchImpl);
  return {
    async fetch(request, env) {
      const allowedOrigin = env.FRONTEND_ORIGIN;
      const origin = request.headers.get('Origin');
      if (!allowedOrigin || !/^https:\/\/[^/]+$/.test(allowedOrigin) || !env.FIREBASE_PROJECT_ID) {
        return response(503, 'configuration_unavailable');
      }
      if (origin && origin !== allowedOrigin) return response(403, 'origin_denied');
      if (request.method === 'OPTIONS') {
        if (!origin) return response(400, 'origin_required');
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Max-Age': '600',
            Vary: 'Origin',
          },
        });
      }
      if (request.method !== 'POST') return response(405, 'method_not_allowed', origin);
      const match = new URL(request.url).pathname.match(/^\/admin\/users\/([A-Za-z0-9_-]{1,128})\/(disable|delete)$/);
      if (!match) return response(404, 'not_found', origin);
      const [, targetUid, operation] = match;
      const bearer = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!bearer) return response(401, 'authentication_required', origin);

      let claims;
      try {
        claims = await verifyFirebaseToken(bearer, env.FIREBASE_PROJECT_ID, { resolveKey: keyResolver });
      } catch {
        return response(401, 'invalid_token', origin);
      }
      if (claims.email !== OWNER_EMAIL || claims.email_verified !== true) return response(403, 'admin_required', origin);
      if (targetUid === claims.sub) return response(409, 'owner_account_protected', origin);

      let body = {};
      if (operation === 'delete') {
        if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return response(413, 'request_too_large', origin);
        try { body = await request.json(); } catch { return response(400, 'invalid_json', origin); }
        if (body?.cleanupComplete !== true) return response(400, 'cleanup_confirmation_required', origin);
      }

      try {
        const accessToken = await serviceAccountToken(env, fetchImpl);
        const owner = await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'lookup', { email: [OWNER_EMAIL] });
        const matchedOwner = singleUser(owner.users, claims.sub);
        if (!matchedOwner || matchedOwner.email !== OWNER_EMAIL || matchedOwner.emailVerified !== true) {
          return response(409, 'owner_identity_ambiguous', origin);
        }
        const lookup = await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'lookup', { localId: [targetUid] });
        if (!Array.isArray(lookup.users) || lookup.users.length === 0) {
          return operation === 'delete' ? response(200, 'already_deleted', origin) : response(404, 'target_not_found', origin);
        }
        const target = singleUser(lookup.users, targetUid);
        if (!target || !target.email || target.email.toLowerCase() === OWNER_EMAIL) return response(409, 'target_identity_ambiguous', origin);
        if (operation === 'disable') {
          if (target.disabled === true) return response(200, 'already_disabled', origin);
          await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'update', { localId: targetUid, disableUser: true });
          return response(200, 'disabled', origin);
        }
        if (target.disabled !== true) return response(409, 'target_must_be_disabled', origin);
        await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'delete', { localId: targetUid });
        return response(200, 'deleted', origin);
      } catch {
        return response(502, 'upstream_unavailable', origin);
      }
    },
  };
}

export default createWorker();
