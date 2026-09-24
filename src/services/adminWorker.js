const baseUrl = import.meta.env.VITE_SECURITY_WORKER_URL;

export function hasAdminWorker() {
  return typeof baseUrl === 'string' && /^https:\/\/[^/]+$/.test(baseUrl);
}

export async function runAdminWorker(user, uid, operation, payload = {}) {
  if (!hasAdminWorker()) throw new Error('尚未設定管理 Worker 網址。');
  const token = await user.getIdToken(true);
  const response = await fetch(`${baseUrl}/admin/users/${encodeURIComponent(uid)}/${operation}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(`管理 Worker 拒絕操作：${result.code || response.status}`);
  }
  return response.json();
}
