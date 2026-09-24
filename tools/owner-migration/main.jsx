import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  GoogleAuthProvider, inMemoryPersistence, linkWithPopup,
  setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';
import { auth } from '../../src/firebase';
import { verifyBeforeLink, verifyAfterLink } from './guard';

const OWNER_EMAIL = 'ctom40101@gmail.com';
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export function MigrationPage() {
  const [expectedUid, setExpectedUid] = useState('');
  const [password, setPassword] = useState('');
  const [ownerUser, setOwnerUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [finished, setFinished] = useState(false);
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (!local) return <main><h1>此工具只允許在本機使用。</h1></main>;

  const login = async event => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await setPersistence(auth, inMemoryPersistence);
      const result = await signInWithEmailAndPassword(auth, OWNER_EMAIL, password);
      setPassword('');
      verifyBeforeLink(result.user, expectedUid.trim());
      setOwnerUser(result.user);
      setStatus('已確認舊帳號 UID。下一步須由 Owner 選擇相同的 Google 帳號。');
    } catch (error) {
      await signOut(auth).catch(() => {});
      setOwnerUser(null);
      setStatus(`安全停止：${error?.code || error?.message || '登入或 UID 查核失敗'}`);
    } finally { setBusy(false); setPassword(''); }
  };

  const link = async () => {
    if (!ownerUser || finished) return;
    setBusy(true);
    setStatus('');
    try {
      const linked = await linkWithPopup(ownerUser, provider);
      verifyAfterLink(linked.user, expectedUid.trim());
      await signOut(auth);
      const googleLogin = await signInWithPopup(auth, provider);
      verifyAfterLink(googleLogin.user, expectedUid.trim());
      setFinished(true);
      setStatus('Google 登入回讀成功；原 Owner UID 未變。請再於 Firebase 控制台唯讀核對一次，然後登出。');
    } catch (error) {
      setStatus(`安全停止：${error?.code || error?.message || '連結或回讀失敗'}。請保留現況並核對 Firebase Auth。`);
    } finally { setBusy(false); }
  };

  return (
    <main style={{ maxWidth: 560, margin: '48px auto', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
      <h1>Owner Google 帳號連結</h1>
      <p>只在 Security Hardening Final Release Human Gate 核准後使用。本頁不存放密碼或 token。</p>
      <p>現有 Firebase 帳號：{OWNER_EMAIL}</p>
      <form onSubmit={login}>
        <label>Firebase 控制台回讀的原始 UID
          <input value={expectedUid} onChange={event => setExpectedUid(event.target.value)} required style={{ display: 'block', width: '100%' }} />
        </label>
        <label>由 Owner 親自輸入舊 Firebase 帳號密碼
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} required style={{ display: 'block', width: '100%' }} />
        </label>
        <button disabled={busy || !!ownerUser} type="submit">核對原始 UID</button>
      </form>
      {ownerUser && !finished && <button disabled={busy} onClick={link}>連結並回讀 Google 登入</button>}
      {finished && <button onClick={() => signOut(auth)}>登出本機工具</button>}
      {status && <p role="status">{status}</p>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<MigrationPage />);
