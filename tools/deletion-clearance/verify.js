const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PROJECT_PATTERN = /^[a-z][a-z0-9-]{4,62}$/;

function endpoint(projectId, path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

async function firestore(fetchImpl, token, url, init = {}) {
  const result = await fetchImpl(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (result.status === 404 && !init.method) return null;
  if (!result.ok) throw new Error('Privileged Firestore inventory failed');
  return result.json();
}

export async function inspectDeletionCandidate({ projectId, appId = projectId, uid, email, token, fetchImpl = fetch }) {
  if (!PROJECT_PATTERN.test(projectId) || !PROJECT_PATTERN.test(appId) || !UID_PATTERN.test(uid) || typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !token) throw new Error('Invalid inventory input');
  const request = await firestore(fetchImpl, token, endpoint(projectId, `AccessRequests/${uid}`));
  if (request?.fields?.uid?.stringValue !== uid || request.fields.email?.stringValue !== email ||
      request.fields.status?.stringValue !== 'disabled' || !request.updateTime) {
    throw new Error('Access request identity or disabled state mismatch');
  }
  if (!request.fields.deletionStartedAt?.timestampValue && !request.fields.selfDeleteRequestedAt?.timestampValue) {
    throw new Error('Deletion was not started');
  }
  const rootPath = `artifacts/${appId}/users/${uid}`;
  const index = await firestore(fetchImpl, token, endpoint(projectId, `artifacts/${appId}/public/data/UserIndex/${uid}`));
  if (index) throw new Error('UserIndex still exists');
  const root = await firestore(fetchImpl, token, endpoint(projectId, rootPath));
  if (root) throw new Error('User root document still exists');
  let pageToken;
  for (let page = 0; page < 100; page++) {
    const result = await firestore(fetchImpl, token, `${endpoint(projectId, rootPath)}:listCollectionIds`, {
      method: 'POST', body: JSON.stringify({ pageSize: 100, ...(pageToken ? { pageToken } : {}) }),
    });
    if (!Array.isArray(result.collectionIds || [])) throw new Error('Invalid collection inventory');
    if (result.collectionIds?.length) throw new Error('Private data collections remain');
    if (!result.nextPageToken) return { uid, email, requestUpdateTime: request.updateTime };
    pageToken = result.nextPageToken;
  }
  throw new Error('Collection inventory pagination limit exceeded');
}

export async function issueDeletionClearance(options) {
  const { projectId, appId, uid, email, token, fetchImpl = fetch, commit = false } = options;
  const proof = await inspectDeletionCandidate({ projectId, appId, uid, email, token, fetchImpl });
  if (!commit) return { issued: false, ...proof };
  const url = endpoint(projectId, `DeletionClearances/${uid}`);
  const existing = await firestore(fetchImpl, token, url);
  if (existing) throw new Error('Clearance already exists; inspect it before retrying');
  const fields = {
    uid: { stringValue: uid }, email: { stringValue: email },
    requestUpdateTime: { stringValue: proof.requestUpdateTime },
  };
  await firestore(fetchImpl, token, `${url}?currentDocument.exists=false`, {
    method: 'PATCH', body: JSON.stringify({ fields }),
  });
  return { issued: true, ...proof };
}
