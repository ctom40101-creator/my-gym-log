import { useState } from 'react';
import { Dumbbell, Loader2 } from 'lucide-react';
import { loginWithGoogle, reloadGoogleRedirect } from '../services/authService';
import { loginWithLegacyPassword, sendMigrationReset } from '../services/legacyMigrationClient';

export default function AuthScreen({ googleRedirectState = { phase: 'ready', errorCode: null, reloadRequired: false } }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const redirectBusy = googleRedirectState.phase === 'recovering' || googleRedirectState.phase === 'redirecting';
  const needsReload = googleRedirectState.reloadRequired;
  const recoveryConflict = googleRedirectState.errorCode === 'auth/account-exists-with-different-credential'
    || googleRedirectState.errorCode === 'auth/credential-already-in-use';
  const displayMessage = message || (recoveryConflict
    ? '偵測到既有帳號與 Google 登入身分衝突。為保護原有 UID 與資料，請停止操作並聯絡管理員。'
    : googleRedirectState.errorCode ? 'Google 登入未完成，請稍後重試。' : '');

  const login = async () => {
    setLoading(true);
    setMessage('');
    try {
      await loginWithGoogle();
    } catch (error) {
      if (error?.code === 'auth/account-exists-with-different-credential' ||
          error?.code === 'auth/credential-already-in-use') {
        setMessage('偵測到既有帳號與 Google 登入身分衝突。為保護原有 UID 與資料，請停止操作並聯絡管理員。');
      } else if (error?.code !== 'auth/popup-closed-by-user') {
        setMessage('Google 登入未完成，請稍後重試。');
      }
    } finally {
      setLoading(false);
    }
  };

  const loginLegacy = async event => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try { await loginWithLegacyPassword(email, password); }
    catch { setMessage('舊帳號登入未完成。請確認原 Email/Password，或使用忘記密碼。'); }
    finally { setPassword(''); setLoading(false); }
  };

  const resetLegacy = async () => {
    setLoading(true);
    setMessage('');
    try {
      await sendMigrationReset(email);
      setMessage('若此 Email 有既有 Firebase 帳號，重設密碼通知將寄至該帳號信箱。');
    } catch { setMessage('目前無法寄送重設通知，請稍後重試。'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border p-6 text-center">
        <Dumbbell className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
        <h1 className="text-3xl font-extrabold text-gray-900">My Gym Log</h1>
        <p className="text-sm text-gray-500 mt-3 mb-6">使用 Google 帳號登入。首次登入後請提交使用申請。</p>
        {redirectBusy && <p role="status" className="mb-4 text-sm text-gray-600">{googleRedirectState.phase === 'recovering' ? '正在確認 Google 登入結果…' : '正在開啟 Google 登入…'}</p>}
        <button onClick={needsReload ? reloadGoogleRedirect : login} disabled={redirectBusy || (!needsReload && loading)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center">
          {!needsReload && (loading || redirectBusy) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          {needsReload ? '重新載入並重試' : '使用 Google 登入'}
        </button>
        {displayMessage && <p role="alert" className="mt-4 text-sm text-red-700">{displayMessage}</p>}
        {!redirectBusy && !needsReload && <div className="mt-6 border-t pt-4 text-left">
          <button type="button" onClick={() => setLegacyOpen(value => !value)} className="text-sm font-semibold text-indigo-700 underline">
            既有 Email/Password 帳號遷移
          </button>
          {legacyOpen && <form onSubmit={loginLegacy} className="mt-3 space-y-3">
            <p className="text-xs text-gray-600">僅供既有帳號登入並連結 Google；不提供新帳號註冊。</p>
            <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="原帳號 Email" className="w-full rounded-lg border px-3 py-2" />
            <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="原帳號密碼" className="w-full rounded-lg border px-3 py-2" />
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-gray-800 py-2 text-white disabled:opacity-60">以原帳號登入</button>
            <button type="button" disabled={loading || !email.trim()} onClick={resetLegacy} className="text-sm text-indigo-700 underline disabled:opacity-50">忘記密碼／寄送重設 Email</button>
          </form>}
        </div>}
      </div>
    </div>
  );
}
