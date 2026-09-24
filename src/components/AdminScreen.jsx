import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { APP_ID, ADMIN_EMAIL } from '../constants';
import { stagedDeleteUser } from '../services/accountDeletion';
import { hasAdminWorker, runAdminWorker } from '../services/adminWorker';

const collectionsToDelete = ['LogDB', 'BodyMetricsDB', 'MovementDB', 'PlansDB', 'Settings'];
const statusText = { pending: '待審核', approved: '已核准', rejected: '已拒絕', disabled: '已停用' };

async function deleteCollection(db, uid, name) {
  const path = collection(db, `artifacts/${APP_ID}/users/${uid}/${name}`);
  while (true) {
    const snapshot = await getDocs(path);
    if (snapshot.empty) return;
    for (const entry of snapshot.docs) await deleteDoc(entry.ref);
  }
}

export default function AdminScreen({ db, admin, setAdminViewUser }) {
  const [requests, setRequests] = useState([]);
  const [indexes, setIndexes] = useState({});
  const [busyUid, setBusyUid] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubRequests = onSnapshot(collection(db, 'AccessRequests'), snapshot => {
      setRequests(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })));
    }, () => setMessage('無法讀取使用申請。'));
    const unsubIndex = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/UserIndex`), snapshot => {
      setIndexes(Object.fromEntries(snapshot.docs.map(entry => [entry.id, entry.data()])));
    }, () => setMessage('無法讀取使用者名冊。'));
    return () => { unsubRequests(); unsubIndex(); };
  }, [db]);

  const decide = async (request, status) => {
    setBusyUid(request.id);
    setMessage('');
    try {
      await updateDoc(doc(db, 'AccessRequests', request.id), {
        status, decidedAt: serverTimestamp(), decidedBy: admin.uid,
      });
    } catch {
      setMessage(`無法更新 ${request.email || request.id} 的狀態。`);
    } finally { setBusyUid(''); }
  };

  const permanentlyDelete = async request => {
    if (!hasAdminWorker()) { setMessage('管理 Worker 尚未設定；無法永久刪除帳號。'); return; }
    if (request.id === admin.uid || request.email?.toLowerCase() === ADMIN_EMAIL) {
      setMessage('Owner 帳號受到保護，不可刪除。');
      return;
    }
    const typed = window.prompt(`永久刪除 ${request.email || request.id} 的 Auth 帳號與已知資料路徑。請輸入完整 UID 確認：`);
    if (typed !== request.id) return;
    setBusyUid(request.id);
    setMessage('');
    try {
      await stagedDeleteUser(request.id, {
        markDisabled: uid => updateDoc(doc(db, 'AccessRequests', uid), {
          status: 'disabled', decidedAt: serverTimestamp(), decidedBy: admin.uid,
        }),
        disableAuth: uid => runAdminWorker(admin, uid, 'disable'),
        deletePrivateData: async uid => {
          for (const name of collectionsToDelete) await deleteCollection(db, uid, name);
        },
        deleteIndex: uid => deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/UserIndex`, uid)),
        deleteAuth: uid => runAdminWorker(admin, uid, 'delete', { cleanupComplete: true }),
        deleteRequest: uid => deleteDoc(doc(db, 'AccessRequests', uid)),
      });
      setAdminViewUser(null);
      setMessage(`已刪除 ${request.id}。`);
    } catch (error) {
      setMessage(`${request.id} 的刪除流程停在安全階段：${error.message}。帳號可能已停用，請檢查狀態再重試。`);
    } finally { setBusyUid(''); }
  };

  const ordered = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0);
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <h2 className="text-lg font-bold">使用申請與帳號管理</h2>
        <p className="text-sm text-gray-600 mt-1">權限以 AccessRequests 狀態為準。永久刪除會先停用帳號，再清理資料。</p>
        {!hasAdminWorker() && <p className="text-sm text-amber-700 mt-2">管理 Worker 尚未設定，永久刪除功能暫停。</p>}
        {message && <p role="status" className="text-sm text-red-700 mt-2">{message}</p>}
      </div>
      {ordered.map(request => {
        const index = indexes[request.id] || {};
        const busy = busyUid === request.id;
        return (
          <div key={request.id} className="bg-white border rounded-xl p-4 space-y-2">
            <div className="font-bold">{index.nickname || request.displayName || request.email || request.id}</div>
            <div className="text-xs text-gray-600 break-all">{request.email} · UID: {request.id}</div>
            <div className="text-sm">狀態：{statusText[request.status] || '不明'}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button disabled={busy} onClick={() => decide(request, 'approved')} className="px-3 py-2 bg-green-100 text-green-800 rounded-lg disabled:opacity-50">核准</button>
              <button disabled={busy} onClick={() => decide(request, 'rejected')} className="px-3 py-2 bg-orange-100 text-orange-800 rounded-lg disabled:opacity-50">拒絕</button>
              <button disabled={busy} onClick={() => decide(request, 'disabled')} className="px-3 py-2 bg-gray-100 rounded-lg disabled:opacity-50">停用權限</button>
              <button disabled={busy} onClick={() => setAdminViewUser({ id: request.id, email: request.email, nickname: index.nickname || request.displayName })} className="px-3 py-2 bg-indigo-100 text-indigo-800 rounded-lg disabled:opacity-50">查看訓練資料</button>
              <button disabled={busy || !hasAdminWorker()} onClick={() => permanentlyDelete(request)} className="px-3 py-2 bg-red-100 text-red-800 rounded-lg disabled:opacity-50">永久刪除</button>
            </div>
          </div>
        );
      })}
      {ordered.length === 0 && <p className="text-gray-500 text-sm">目前沒有使用申請。</p>}
    </div>
  );
}
