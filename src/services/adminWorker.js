const baseUrl = import.meta.env.VITE_SECURITY_WORKER_URL;

export function hasAdminWorker() {
  return typeof baseUrl === 'string' && /^https:\/\/[^/]+$/.test(baseUrl);
}

export async function runAdminWorker(user, uid, operation) {
  if (!hasAdminWorker()) throw new Error('尚未設定管理 Worker 網址。');
  const token = await user.getIdToken(true);
  const response = await fetch(`${baseUrl}/admin/users/${encodeURIComponent(uid)}/${operation}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(`管理 Worker 拒絕操作：${result.code || response.status}`);
  }
  return response.json();
}

export async function runSelfDelete(user) {
  if (!hasAdminWorker()) throw new Error('尚未設定管理 Worker 網址。');
  const token = await user.getIdToken(true);
  const response = await fetch(`${baseUrl}/self/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(`帳號清理驗證未通過：${result.code || response.status}`);
  }
  return response.json();
}
