import { deletePrivateTree } from './firestoreTree.js';
import { isLegacyTargetPolicy } from '../../src/services/legacyMigrationPolicy.js';

const UID = /^[A-Za-z0-9_-]{1,128}$/;
const PROJECT = /^[a-z][a-z0-9-]{4,62}$/;
const field = (document, name) => document?.fields?.[name];
const string = (document, name) => field(document, name)?.stringValue;
const boolean = (document, name) => field(document, name)?.booleanValue;
const timestamp = (document, name) => field(document, name)?.timestampValue;
const fsString = value => ({ stringValue: value });
const fsBoolean = value => ({ booleanValue: value });
const fsTimestamp = value => ({ timestampValue: value });

function validUid(uid) {
  if (!UID.test(uid)) throw new Error('invalid_uid');
  return uid;
}

function decodePolicy(document) {
  if (!document) return null;
  return {
    program: string(document, 'program'), cohort: string(document, 'cohort'),
    originalUid: string(document, 'originalUid'), deadlineAt: string(document, 'deadlineAt'),
    state: string(document, 'state'), deletionHold: boolean(document, 'deletionHold'),
    intentExpiresAt: timestamp(document, 'intentExpiresAt'),
    lockExpiresAt: timestamp(document, 'lockExpiresAt'),
  };
}

export function createRetentionApi(env, token, fetchImpl = fetch) {
  const project = env.FIREBASE_PROJECT_ID;
  const appId = env.APP_ID || project;
  if (!PROJECT.test(project) || !PROJECT.test(appId) || !token) throw new Error('retention_configuration_invalid');
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
  const documents = `${base}/documents`;
  const authBase = `https://identitytoolkit.googleapis.com/v1/projects/${project}`;
  let subrequests = 0;
  const request = async (url, init = {}, allow = []) => {
    if (++subrequests > 48) throw new Error('retention_subrequest_budget');
    const response = await fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (allow.includes(response.status)) return { status: response.status, body: null };
    if (!response.ok) throw new Error('retention_upstream_failed');
    const payload = await response.text();
    return { status: response.status, body: payload ? JSON.parse(payload) : null };
  };
  const docUrl = path => `${documents}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const getDocument = async path => (await request(docUrl(path), {}, [404])).body;
  const deleteDocument = async path => { await request(docUrl(path), { method: 'DELETE' }, [404]); };
  const authOperation = async (operation, body) => (await request(`${authBase}/accounts:${operation}`, {
    method: 'POST', body: JSON.stringify(body),
  })).body;
  const policyPath = uid => `MigrationPolicies/${validUid(uid)}`;
  const privateRoot = uid => `artifacts/${appId}/users/${validUid(uid)}`;
  const jobPath = uid => `RetentionJobs/${validUid(uid)}`;
  const commitPolicy = async (uid, currentUpdateTime, fields, fieldPaths, allowed = []) => request(`${documents}:commit`, {
    method: 'POST', body: JSON.stringify({ writes: [{
      update: { name: `${documents}/${policyPath(uid)}`, fields },
      updateMask: { fieldPaths },
      currentDocument: { updateTime: currentUpdateTime },
    }] }),
  }, allowed);
  const listCollectionIds = async path => {
    const { body } = await request(`${docUrl(path)}:listCollectionIds`, {
      method: 'POST', body: JSON.stringify({ pageSize: 1 }),
    });
    if (!body || !Array.isArray(body.collectionIds || [])
      || ((body.collectionIds || []).length === 0 && body.nextPageToken)) {
      throw new Error('collection_inventory_ambiguous');
    }
    return body.collectionIds || [];
  };
  const listDocuments = async collectionPath => {
    const url = new URL(docUrl(collectionPath));
    url.searchParams.set('pageSize', '1');
    url.searchParams.set('showMissing', 'true');
    const { body } = await request(url.toString());
    if (!body || !Array.isArray(body.documents || [])
      || ((body.documents || []).length === 0 && body.nextPageToken)) {
      throw new Error('document_inventory_ambiguous');
    }
    return (body.documents || []).map(item => {
      const prefix = `projects/${project}/databases/(default)/documents/`;
      if (!item.name?.startsWith(prefix)) throw new Error('document_scope_mismatch');
      return { path: item.name.slice(prefix.length), exists: !!item.updateTime };
    });
  };
  const api = {
    async getOwnerUid() {
      const owner = await getDocument('SecurityConfig/owner');
      const uid = string(owner, 'uid');
      return uid && UID.test(uid) ? uid : null;
    },
    async listTargets() {
      const url = new URL(docUrl('MigrationPolicies'));
      url.searchParams.set('pageSize', '100');
      const { body } = await request(url.toString());
      if (body.nextPageToken || !Array.isArray(body.documents) || body.documents.length !== 2) throw new Error('roster_ambiguous');
      const rows = body.documents.map(document => {
        const uid = document.name?.split('/').at(-1);
        const policy = decodePolicy(document);
        if (!isLegacyTargetPolicy(policy, uid) || !document.updateTime) throw new Error('roster_ambiguous');
        return { uid, policy, updateTime: document.updateTime };
      });
      if (new Set(rows.map(row => row.uid)).size !== 2 || new Set(rows.map(row => row.policy.cohort)).size !== 2) {
        throw new Error('roster_ambiguous');
      }
      return rows;
    },
    async getPolicy(uid) {
      const document = await getDocument(policyPath(uid));
      return document ? { policy: decodePolicy(document), updateTime: document.updateTime } : null;
    },
    async getAuth(uid) {
      const payload = await authOperation('lookup', { localId: [validUid(uid)] });
      if (payload.users == null) return null;
      if (!Array.isArray(payload.users) || payload.users.length !== 1 || payload.users[0]?.localId !== uid
        || typeof payload.users[0].email !== 'string') throw new Error('auth_identity_mismatch');
      const user = payload.users[0];
      if (!Array.isArray(user.providerUserInfo)
        || user.providerUserInfo.some(item => typeof item?.providerId !== 'string' || !item.providerId)) {
        throw new Error('auth_provider_ambiguous');
      }
      return { localId: user.localId, email: user.email, disabled: user.disabled === true,
        providerUserInfo: user.providerUserInfo };
    },
    async assertNoGoogle(uid) {
      const freshAuth = await api.getAuth(uid);
      if (!freshAuth || !Array.isArray(freshAuth.providerUserInfo)) {
        throw new Error('auth_ambiguous_during_cleanup');
      }
      if (freshAuth.providerUserInfo.some(item => item.providerId === 'google.com')) {
        throw new Error('google_linked_during_cleanup');
      }
    },
    async acquireLock(uid, updateTime, now) {
      const fresh = await api.getPolicy(uid);
      if (!fresh || fresh.updateTime !== updateTime || fresh.policy.deletionHold) return false;
      if (fresh.policy.state === 'DELETION_IN_PROGRESS') {
        const expiry = Date.parse(fresh.policy.lockExpiresAt || '');
        if (!Number.isFinite(expiry) || expiry >= now) return false;
      }
      const lockId = crypto.randomUUID();
      const fields = {
        state: fsString('DELETION_IN_PROGRESS'),
        lockId: fsString(lockId),
        lockExpiresAt: fsTimestamp(new Date(now + 30 * 60_000).toISOString()),
      };
      const outcome = await commitPolicy(uid, updateTime, fields, Object.keys(fields), [409, 412]);
      return outcome.status < 400 ? lockId : null;
    },
    async assertLock(uid, lockId) {
      const fresh = await getDocument(policyPath(uid));
      const expiry = Date.parse(timestamp(fresh, 'lockExpiresAt') || '');
      if (!lockId || string(fresh, 'lockId') !== lockId
        || string(fresh, 'state') !== 'DELETION_IN_PROGRESS'
        || boolean(fresh, 'deletionHold') !== false
        || !Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('lock_lost');
    },
    async disableAuth(uid) { await authOperation('update', { localId: validUid(uid), disableUser: true }); },
    async restoreAuth(uid) { await authOperation('update', { localId: validUid(uid), disableUser: false }); },
    async cancelForGoogle(uid) {
      const fresh = await api.getPolicy(uid);
      if (!fresh?.updateTime) throw new Error('policy_unavailable');
      await commitPolicy(uid, fresh.updateTime,
        { state: fsString('MIGRATED_GOOGLE_ONLY'), deletionHold: fsBoolean(true) },
        ['state', 'deletionHold', 'lockId', 'lockExpiresAt']);
    },
    async loadCursor(uid) {
      const root = privateRoot(uid);
      const job = await getDocument(jobPath(uid));
      const cursor = job ? string(job, 'cursorPath') : root;
      if (typeof cursor !== 'string' || (cursor !== root && !cursor.startsWith(`${root}/`))) {
        throw new Error('retention_cursor_ambiguous');
      }
      return cursor;
    },
    async saveCursor(uid, cursor) {
      const root = privateRoot(uid);
      if (typeof cursor !== 'string' || (cursor !== root && !cursor.startsWith(`${root}/`))) {
        throw new Error('retention_cursor_ambiguous');
      }
      const url = new URL(docUrl(jobPath(uid)));
      url.searchParams.set('updateMask.fieldPaths', 'cursorPath');
      await request(url.toString(), { method: 'PATCH', body: JSON.stringify({ fields: {
        cursorPath: fsString(cursor),
      } }) });
    },
    async clearCursor(uid) { await deleteDocument(jobPath(uid)); },
    async deletePrivateRecursively(uid, lockId) {
      const root = privateRoot(uid);
      const cursor = await api.loadCursor(uid);
      const result = await deletePrivateTree(root, {
        documentExists: async path => !!await getDocument(path),
        listCollections: listCollectionIds,
        listDocuments,
        deleteDocument: async path => {
          await api.assertLock(uid, lockId);
          await api.assertNoGoogle(uid);
          await deleteDocument(path);
        },
      }, 7, cursor);
      await api.assertLock(uid, lockId);
      if (!result.complete) {
        await api.saveCursor(uid, result.cursor);
        return result;
      }
      if (!await api.verifyPrivateRootEmpty(uid)) {
        await api.saveCursor(uid, root);
        return { ...result, complete: false, cursor: root };
      }
      await api.clearCursor(uid);
      return result;
    },
    async verifyPrivateRootEmpty(uid) {
      const root = privateRoot(uid);
      return !await getDocument(root) && (await listCollectionIds(root)).length === 0;
    },
    async deleteIndex(uid, lockId) {
      await api.assertLock(uid, lockId);
      await api.assertNoGoogle(uid);
      await deleteDocument(`artifacts/${appId}/public/data/UserIndex/${validUid(uid)}`);
    },
    async deleteAccessRequest(uid, lockId) {
      await api.assertLock(uid, lockId);
      await api.assertNoGoogle(uid);
      await deleteDocument(`AccessRequests/${validUid(uid)}`);
    },
    async verifyCleanup(uid) {
      return await api.verifyPrivateRootEmpty(uid)
        && !await getDocument(`artifacts/${appId}/public/data/UserIndex/${validUid(uid)}`)
        && !await getDocument(`AccessRequests/${validUid(uid)}`);
    },
    async deleteAuth(uid) { await authOperation('delete', { localId: validUid(uid) }); },
    async markDeleted(uid, lockId) {
      if (lockId) await api.assertLock(uid, lockId);
      const fresh = await api.getPolicy(uid);
      if (!fresh?.updateTime || fresh.policy.state !== 'DELETION_IN_PROGRESS') throw new Error('receipt_policy_mismatch');
      const receiptPath = `DeletionReceipts/${validUid(uid)}`;
      const receipt = await getDocument(receiptPath);
      if (!receipt) {
        const url = new URL(docUrl(receiptPath));
        url.searchParams.set('currentDocument.exists', 'false');
        await request(url.toString(), { method: 'PATCH', body: JSON.stringify({ fields: {
          program: fsString('LEGACY_ACCOUNT_SUNSET_2026'), cohort: fsString(fresh.policy.cohort),
          deletedAt: fsTimestamp(new Date().toISOString()),
        } }) });
      } else if (string(receipt, 'program') !== 'LEGACY_ACCOUNT_SUNSET_2026'
        || string(receipt, 'cohort') !== fresh.policy.cohort) throw new Error('receipt_ambiguous');
      const latest = await api.getPolicy(uid);
      await commitPolicy(uid, latest.updateTime, { state: fsString('DELETED') },
        ['state', 'lockId', 'lockExpiresAt']);
    },
  };
  return api;
}
