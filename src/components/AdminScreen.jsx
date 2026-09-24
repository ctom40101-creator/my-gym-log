import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { APP_ID, ADMIN_EMAIL } from '../constants';
import { finalizeDeleteUser, stagedDeleteUser } from '../services/accountDeletion';
import { markAdminDeletionStarted } from '../services/deletionRequest';
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
    if (request.deletionStartedAt || request.selfDeleteRequestedAt) {
      setMessage('此帳號已開始刪除，不能重新核准或改變狀態。');
      return;
    }
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

  const prepareDelete = async request => {
    if (!hasAdminWorker()) { setMessage('管理 Worker 尚未設定；無法永久刪除帳號。'); return; }
    if (request.id === admin.uid || request.email?.toLowerCase() === ADMIN_EMAIL) {
      setMessage('Owner 帳號受到保護，不可刪除。');
      return;
    }
    const typed = window.prompt(`開始刪除 ${request.email || request.id}：鎖定存取並清除已知資料。完整盤點與 Auth 永久刪除需另行完成。請輸入完整 UID 確認：`);
    if (typed !== request.id) return;
    setBusyUid(request.id);
    setMessage('');
    try {
      await stagedDeleteUser(request.id, {
        markDisabled: uid => markAdminDeletionStarted(db, uid, admin.uid),
        disableAuth: async uid => {
          const fresh = await getDoc(doc(db, 'AccessRequests', uid));
          if (!fresh.exists() || fresh.data().status !== 'disabled') throw new Error('Deletion state conflict');
          // Keep Auth enabled briefly for a member-initiated request, so recent
          // Google reauthentication can finish after the independent inventory.
          if (!fresh.data().selfDeleteRequestedAt) await runAdminWorker(admin, uid, 'disable');
        },
        deletePrivateData: async uid => {
          for (const name of collectionsToDelete) await deleteCollection(db, uid, name);
        },
        deleteRoot: uid => deleteDoc(doc(db, `artifacts/${APP_ID}/users`, uid)),
        deleteIndex: uid => deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/UserIndex`, uid)),
      });
      setAdminViewUser(null);
      setMessage(`${request.id} 的資料存取已停用並清理已知資料。完成完整盤點並核發受保護憑證後，才能永久刪除 Auth。`);
    } catch (error) {
      setMessage(`${request.id} 的刪除流程停在安全階段：${error.message}。帳號可能已停用，請檢查狀態再重試。`);
    } finally { setBusyUid(''); }
  };

  const finishDelete = async request => {
    if (request.status !== 'disabled' || !hasAdminWorker()) return;
    setBusyUid(request.id);
    setMessage('');
    try {
      await finalizeDeleteUser(request.id, {
        deleteAuth: async uid => {
          await runAdminWorker(admin, uid, 'disable');
          await runAdminWorker(admin, uid, 'delete');
        },
        deleteMetadata: uid => {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'AccessRequests', uid));
          batch.delete(doc(db, 'DeletionClearances', uid));
          return batch.commit();
        },
      });
      setMessage(`${request.id} 的 Auth 與刪除紀錄已清理。`);
    } catch (error) {
      setMessage(`${request.id} 尚未完成永久刪除：${error.message}。請確認完整盤點憑證與剩餘紀錄。`);
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
        <p className="text-sm text-gray-600 mt-1">權限以 AccessRequests 狀態為準。先停用帳號並清理已知路徑，再由受保護的完整盤點憑證放行 Auth 刪除。缺少憑證時會維持停用。</p>
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
              <button disabled={busy || !!request.deletionStartedAt || !!request.selfDeleteRequestedAt} onClick={() => decide(request, 'approved')} className="px-3 py-2 bg-green-100 text-green-800 rounded-lg disabled:opacity-50">核准</button>
              <button disabled={busy || !!request.deletionStartedAt || !!request.selfDeleteRequestedAt} onClick={() => decide(request, 'rejected')} className="px-3 py-2 bg-orange-100 text-orange-800 rounded-lg disabled:opacity-50">拒絕</button>
              <button disabled={busy || !!request.deletionStartedAt || !!request.selfDeleteRequestedAt} onClick={() => decide(request, 'disabled')} className="px-3 py-2 bg-gray-100 rounded-lg disabled:opacity-50">停用權限</button>
              <button disabled={busy} onClick={() => setAdminViewUser({ id: request.id, email: request.email, nickname: index.nickname || request.displayName })} className="px-3 py-2 bg-indigo-100 text-indigo-800 rounded-lg disabled:opacity-50">查看訓練資料</button>
              <button disabled={busy || !hasAdminWorker()} onClick={() => prepareDelete(request)} className="px-3 py-2 bg-red-100 text-red-800 rounded-lg disabled:opacity-50">開始刪除</button>
              {request.status === 'disabled' && <button disabled={busy || !hasAdminWorker()} onClick={() => finishDelete(request)} className="px-3 py-2 bg-red-200 text-red-900 rounded-lg disabled:opacity-50">盤點後完成永久刪除</button>}
            </div>
          </div>
        );
      })}
      {ordered.length === 0 && <p className="text-gray-500 text-sm">目前沒有使用申請。</p>}
    </div>
  );
}
