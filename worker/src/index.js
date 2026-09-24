import { decodeProtectedHeader, importPKCS8, importX509, jwtVerify, SignJWT } from 'jose';

const OWNER_EMAIL = 'ctom40101@gmail.com';
const TOKEN_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const AUTH_API = 'https://identitytoolkit.googleapis.com/v1/projects';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';
const FIRESTORE_API = 'https://firestore.googleapis.com/v1/projects';

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
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) throw new Error('Invalid issued-at time');
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

function sessionNotRevoked(user, authTime) {
  if (typeof user.validSince !== 'string' || !/^\d+$/.test(user.validSince)) return false;
  const validSince = Number(user.validSince);
  return Number.isSafeInteger(validSince) && authTime >= validSince;
}

async function firestoreGet(fetchImpl, projectId, token, path) {
  const url = `${FIRESTORE_API}/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`;
  const result = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error('Firestore read failed');
  return result.json();
}

async function ownerUidMatchesConfig(fetchImpl, projectId, token, uid) {
  const config = await firestoreGet(fetchImpl, projectId, token, 'SecurityConfig/owner');
  return config?.fields?.uid?.stringValue === uid;
}

function deletionStarted(request, uid, email) {
  return request?.fields?.status?.stringValue === 'disabled'
    && request.fields.uid?.stringValue === uid
    && request.fields.email?.stringValue === email
    && !!(request.fields.deletionStartedAt?.timestampValue || request.fields.selfDeleteRequestedAt?.timestampValue);
}

async function cleanupVerified(fetchImpl, projectId, firebaseToken, uid, email) {
  const request = await firestoreGet(fetchImpl, projectId, firebaseToken, `AccessRequests/${uid}`);
  if (!request?.fields?.email?.stringValue ||
      !deletionStarted(request, uid, email ?? request.fields.email.stringValue)) return false;
  const clearance = await firestoreGet(fetchImpl, projectId, firebaseToken, `DeletionClearances/${uid}`);
  return !!request.updateTime
    && clearance?.fields?.uid?.stringValue === uid
    && clearance.fields.email?.stringValue === request.fields.email.stringValue
    && clearance.fields.requestUpdateTime?.stringValue === request.updateTime;
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
      const path = new URL(request.url).pathname;
      const adminMatch = path.match(/^\/admin\/users\/([A-Za-z0-9_-]{1,128})\/(disable|delete)$/);
      const selfDelete = path === '/self/delete';
      if (!adminMatch && !selfDelete) return response(404, 'not_found', origin);
      const operation = selfDelete ? 'delete' : adminMatch[2];
      const bearer = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!bearer) return response(401, 'authentication_required', origin);

      let claims;
      try {
        claims = await verifyFirebaseToken(bearer, env.FIREBASE_PROJECT_ID, { resolveKey: keyResolver });
      } catch {
        return response(401, 'invalid_token', origin);
      }
      if (claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') {
        return response(403, 'verified_google_required', origin);
      }
      if (!selfDelete && claims.email !== OWNER_EMAIL) return response(403, 'admin_required', origin);
      if (selfDelete && (!claims.email || claims.email === OWNER_EMAIL || Math.floor(Date.now() / 1000) - claims.auth_time > 300)) {
        return response(403, 'recent_member_auth_required', origin);
      }
      const targetUid = selfDelete ? claims.sub : adminMatch[1];
      if (!selfDelete && targetUid === claims.sub) return response(409, 'owner_account_protected', origin);

      try {
        const accessToken = await serviceAccountToken(env, fetchImpl);
        if (!selfDelete) {
          const owner = await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'lookup', { email: [OWNER_EMAIL] });
          const matchedOwner = singleUser(owner.users, claims.sub);
          if (!matchedOwner || matchedOwner.email !== OWNER_EMAIL || matchedOwner.emailVerified !== true || matchedOwner.disabled === true || !sessionNotRevoked(matchedOwner, claims.auth_time)) {
            return response(409, 'owner_identity_ambiguous', origin);
          }
          if (!await ownerUidMatchesConfig(fetchImpl, env.FIREBASE_PROJECT_ID, bearer, claims.sub)) {
            return response(409, 'owner_identity_ambiguous', origin);
          }
        }
        const lookup = await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'lookup', { localId: [targetUid] });
        const targetUsers = lookup.users ?? [];
        if (!Array.isArray(targetUsers)) return response(502, 'upstream_unavailable', origin);
        if (targetUsers.length === 0) {
          if (operation === 'delete' && !await cleanupVerified(fetchImpl, env.FIREBASE_PROJECT_ID, bearer, targetUid, null)) {
            return response(409, 'cleanup_incomplete', origin);
          }
          return response(200, 'already_deleted', origin);
        }
        const target = singleUser(targetUsers, targetUid);
        if (!target || !target.email || target.email.toLowerCase() === OWNER_EMAIL) return response(409, 'target_identity_ambiguous', origin);
        if (selfDelete && (target.email !== claims.email || target.emailVerified !== true || !sessionNotRevoked(target, claims.auth_time))) {
          return response(409, 'target_identity_ambiguous', origin);
        }
        if (operation === 'disable') {
          const deletionRequest = await firestoreGet(fetchImpl, env.FIREBASE_PROJECT_ID, bearer, `AccessRequests/${targetUid}`);
          if (!deletionStarted(deletionRequest, targetUid, target.email)) return response(409, 'deletion_not_started', origin);
          if (target.disabled === true) return response(200, 'already_disabled', origin);
          await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'update', { localId: targetUid, disableUser: true });
          return response(200, 'disabled', origin);
        }
        if (!selfDelete && target.disabled !== true) return response(409, 'target_must_be_disabled', origin);
        if (!await cleanupVerified(fetchImpl, env.FIREBASE_PROJECT_ID, bearer, targetUid, target.email)) {
          return response(409, 'cleanup_incomplete', origin);
        }
        await authApi(fetchImpl, env.FIREBASE_PROJECT_ID, accessToken, 'delete', { localId: targetUid });
        return response(200, 'deleted', origin);
      } catch {
        return response(502, 'upstream_unavailable', origin);
      }
    },
  };
}

export default createWorker();
