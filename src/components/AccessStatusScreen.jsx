import { useState } from 'react';
import { logoutUser, reauthenticateWithGoogle } from '../services/authService';
import { submitAccessRequest } from '../services/accessService';
import { finalizeSelfDelete } from '../services/accountDeletion';
import { hasAdminWorker, runSelfDelete } from '../services/adminWorker';

const copy = {
  pending: ['等待審核', '管理員尚未核准使用申請。核准後會自動進入訓練紀錄。'],
  rejected: ['申請未通過', '此帳號的使用申請未通過。請聯絡管理員。'],
  disabled: ['帳號已停用', '此帳號目前無法使用 My Gym Log。請聯絡管理員。'],
  identity_invalid: ['身分無法驗證', '請使用已驗證的 Google 帳號登入；如有舊帳號或 UID 衝突，請聯絡管理員。'],
  request_needed: ['申請使用', '提交申請後，請等待管理員核准。'],
  error: ['暫時無法確認權限', '請稍後重試；目前不會讀取或寫入訓練資料。'],
  legacy_expired: ['舊帳號遷移期限已過', '帳號資料已停止存取。請聯絡管理員確認帳號狀態。'],
};

export default function AccessStatusScreen({ state, user, claims, db, selfDeleteRequested = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, description] = copy[state] || copy.error;

  const submit = async () => {
    setBusy(true);
    setError('');
    try { await submitAccessRequest(db, user, claims); }
    catch { setError('申請未送出，請稍後重試。'); }
    finally { setBusy(false); }
  };

  const finishDeletion = async () => {
    setBusy(true);
    setError('');
    try {
      await finalizeSelfDelete({
        reauthenticate: () => reauthenticateWithGoogle(user),
        deleteAuth: () => runSelfDelete(user),
      });
      await logoutUser();
    } catch (cause) {
      if (cause?.code !== 'auth/popup-closed-by-user') {
        setError('完整盤點憑證尚未核發或 Auth 刪除未完成；帳號維持停用。請聯絡管理員。');
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-gray-600">{description}</p>
        <p className="mt-3 text-xs text-gray-500 break-all">{user?.email || ''}</p>
        {state === 'request_needed' && <button onClick={submit} disabled={busy} className="w-full mt-5 bg-indigo-600 text-white py-3 rounded-xl disabled:opacity-60">提交使用申請</button>}
        {state === 'disabled' && selfDeleteRequested && hasAdminWorker() && <button onClick={finishDeletion} disabled={busy} className="w-full mt-5 bg-red-700 text-white py-3 rounded-xl disabled:opacity-60">盤點完成後刪除 Auth 帳號</button>}
        {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
        <button onClick={logoutUser} className="mt-5 text-sm text-gray-500 underline">登出</button>
      </div>
    </div>
  );
}
