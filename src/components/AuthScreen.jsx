import { useState } from 'react';
import { Dumbbell, Loader2 } from 'lucide-react';
import { loginWithGoogle } from '../services/authService';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border p-6 text-center">
        <Dumbbell className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
        <h1 className="text-3xl font-extrabold text-gray-900">My Gym Log</h1>
        <p className="text-sm text-gray-500 mt-3 mb-6">使用 Google 帳號登入。首次登入後請提交使用申請。</p>
        <button onClick={login} disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center">
          {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          使用 Google 登入
        </button>
        {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
      </div>
    </div>
  );
}
