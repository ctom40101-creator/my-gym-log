import { useEffect, useState } from 'react';
import { linkedGoogleNextStep, migrationNoticeModel } from '../services/legacyMigration';
import { beginLegacyIntent, finishLegacyGoogleMigration, linkCurrentLegacyUser,
  readLegacyProgress, refreshLegacyEmailVerification, sendLegacyVerificationEmail,
  sendMigrationReset, signOutForGoogleVerification } from '../services/legacyMigrationClient';

export default function LegacyMigrationNotice({ user, claims, policy, signInKey, onPolicyChange }) {
  const [now, setNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const [linkedThisSession, setLinkedThisSession] = useState(false);
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified === true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { setEmailVerified(user?.emailVerified === true); }, [user?.uid, user?.emailVerified, signInKey]);
  const model = migrationNoticeModel(policy, user?.uid, null, now, signInKey);
  if (!model.banner || user?.email === 'ctom40101@gmail.com') return null;
  const googleLinked = linkedThisSession || user.providerData?.some(item => item.providerId === 'google.com');
  const passwordLinked = user.providerData?.some(item => item.providerId === 'password');
  const googleSession = claims?.firebase?.sign_in_provider === 'google.com';
  const hasBaseline = !!readLegacyProgress(user.uid);
  const nextStep = linkedGoogleNextStep({ emailVerified });
  const run = async (action) => {
    setBusy(true);
    setStatus('');
    try { await action(); }
    catch { setStatus('遷移尚未完成。請保留原帳號與資料，勿建立新的 Firebase UID；必要時聯絡管理員。'); }
    finally { setBusy(false); }
  };
  const prepare = () => run(async () => {
    await beginLegacyIntent(user);
    setPrepared(true);
    setStatus('原 UID 與資料清單已核對。請選擇本人 Google 帳號連結。');
  });
  const link = () => run(async () => {
    const linked = await linkCurrentLegacyUser(user);
    setLinkedThisSession(true);
    setEmailVerified(linked.emailVerified === true);
    setStatus(linkedGoogleNextStep(linked) === 'verify-original-email'
      ? 'Google 已連結到原 UID。請先驗證原 Firebase 帳號 Email，再以 Google 登入完成遷移。'
      : 'Google 已連結到原 UID。請登出，再按 Google 登入完成驗證。');
  });
  const sendVerification = () => run(async () => {
    await sendLegacyVerificationEmail(user);
    setStatus('驗證信已送往原 Firebase 帳號 Email。完成信中驗證後，請按「重新檢查 Email 驗證」。');
  });
  const refreshVerification = () => run(async () => {
    const verified = await refreshLegacyEmailVerification(user);
    setEmailVerified(verified);
    setStatus(verified ? '原 Email 已驗證。請登出，再按 Google 登入完成驗證。'
      : '原 Email 尚未驗證。請完成驗證信中的步驟後再檢查。');
  });
  const finish = () => run(async () => {
    const completed = await finishLegacyGoogleMigration(user);
    onPolicyChange(completed);
  });
  const reset = () => run(async () => {
    await sendMigrationReset(user.email);
    setStatus('重設通知已送往目前 Firebase Auth 帳號 Email。');
  });
  const actions = <div className="mt-3 flex flex-wrap gap-2">
    {!googleLinked && passwordLinked && !prepared && <button type="button" disabled={busy} onClick={prepare} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">立即連結 Google</button>}
    {!googleLinked && passwordLinked && prepared && <button type="button" disabled={busy} onClick={link} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">選擇 Google 帳號並連結</button>}
    {googleLinked && passwordLinked && !googleSession && !hasBaseline && <button type="button" disabled={busy} onClick={prepare} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">重新核對原 UID 與資料</button>}
    {googleLinked && nextStep === 'verify-original-email' && <button type="button" disabled={busy} onClick={sendVerification} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">寄送原 Email 驗證信</button>}
    {googleLinked && nextStep === 'verify-original-email' && <button type="button" disabled={busy} onClick={refreshVerification} className="rounded-lg border border-white px-3 py-2 text-white disabled:opacity-60">重新檢查 Email 驗證</button>}
    {googleLinked && passwordLinked && !googleSession && nextStep === 'google-sign-in' && <button type="button" disabled={busy} onClick={() => run(signOutForGoogleVerification)} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">登出後以 Google 再登入驗證</button>}
    {googleLinked && googleSession && hasBaseline && nextStep === 'google-sign-in' && <button type="button" disabled={busy} onClick={finish} className="rounded-lg bg-white px-3 py-2 font-bold text-red-800 disabled:opacity-60">完成 Google 遷移驗證</button>}
    {passwordLinked && <button type="button" disabled={busy} onClick={reset} className="rounded-lg border border-white px-3 py-2 text-white disabled:opacity-60">忘記密碼／寄送重設 Email</button>}
  </div>;
  return <>
    <aside role="status" className="z-40 bg-red-800 px-4 py-3 text-sm text-white shadow-lg">
      <strong>舊帳號遷移期限：2026/12/31</strong>{' '}{now <= Date.parse('2026-12-31T15:59:59Z') ? `剩餘 ${model.remainingDays} 天` : '期限已過'}
      <p className="mt-1">{model.message}</p>
      {actions}
      {status && <p role="alert" className="mt-2">{status}</p>}
    </aside>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="舊帳號遷移提醒">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-red-800 p-6 text-white shadow-2xl">
        <h2 className="text-2xl font-extrabold">請完成 Google 帳號遷移</h2>
        <p className="mt-3">{model.message}</p>
        <p className="mt-2 font-bold">剩餘 {model.remainingDays} 天</p>
        {actions}
        {status && <p role="alert" className="mt-3">{status}</p>}
        <button type="button" onClick={() => setModalOpen(false)} className="mt-5 text-sm underline">稍後處理</button>
      </div>
    </div>}
  </>;
}
