'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { FiCamera } from 'react-icons/fi';
import NoticeDialog from '../../components/NoticeDialog';
import SiteHeader from '../../components/SiteHeader';
import { prepareAvatar, saveLocalAvatar, useAvatar } from '../../lib/avatar';
import { deleteAvatar, uploadAvatar } from '../../lib/driveSync';
import { authHeader, ensureSession, signIn, signOut, useGoogleUser } from '../../lib/googleAuth';
import { useI18n } from '../../lib/i18n';
import { errorText } from '../../lib/i18nYoutube';
import { errorMessage, useFlash } from '../../lib/ytFlash';
import { GET_KEY_URL, clearKey, isValidKeyFormat, nextResetLabel, saveKey, useQuota, useStoredKey, useTurnsLeft } from '../../lib/ytClient';

export default function ProfileClient() {
  const router = useRouter();
  const { t } = useI18n();
  const y = t.yt;
  const user = useGoogleUser();
  const { src, custom } = useAvatar();
  const quota = useQuota();
  const storedKey = useStoredKey();
  const fileRef = useRef(null);
  const [usage, setUsage] = useState(null);
  const turns = useTurnsLeft(usage); // một con số duy nhất: số nhỏ hơn giữa lượt của key và giới hạn của app
  const [avatarMsg, setAvatarMsg] = useState(null); // { ok, key } hoặc { ok, code }: khóa trong từ điển, để đổi ngôn ngữ thì chữ đổi theo
  const [keyInput, setKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false); // ô nhập key chỉ hiện khi người dùng bấm "Cập nhật key"
  const [keyMsg, setKeyMsg] = useState(null); // { ok, text }
  const [signInError, setSignInError] = useState('');
  const [notice, closeNotice] = useFlash(); // hết lượt khi tạo bài: trang xem video đưa về đây kèm popup giải thích

  // Khôi phục phiên đăng nhập im lặng nếu có thể
  useEffect(() => {
    ensureSession();
  }, []);

  // Số lượt dịch đã dùng hôm nay
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/youtube/usage', { headers: authHeader(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => !cancelled && setUsage(u))
      .catch(() => !cancelled && setUsage(null));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasKey = isValidKeyFormat(storedKey);
  const keyOut = hasKey && quota.remaining === 0;
  const maskedKey = hasKey ? `${storedKey.slice(0, 4)}••••••••${storedKey.slice(-4)}` : '';

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setAvatarMsg({ ok: true, key: 'avatarSaving' });
    let prepared;
    try {
      prepared = await prepareAvatar(file);
    } catch (err) {
      setAvatarMsg({ ok: false, code: err.code });
      return;
    }
    saveLocalAvatar(prepared.dataUrl); // đổi ngay trên máy này
    if (!user.drive) {
      setAvatarMsg({ ok: true, key: 'avatarLocalOnly' });
      return;
    }
    try {
      await uploadAvatar(user.token, prepared.blob);
      setAvatarMsg({ ok: true, key: 'avatarSaved' });
    } catch {
      setAvatarMsg({ ok: false, key: 'avatarDriveFailed' });
    }
  };

  const onRemoveAvatar = async () => {
    saveLocalAvatar(null);
    setAvatarMsg({ ok: true, key: 'avatarRemoved' });
    if (user?.drive) {
      try {
        await deleteAvatar(user.token);
      } catch {
        setAvatarMsg({ ok: false, key: 'avatarRemoveDriveFailed' });
      }
    }
  };

  const onSaveKey = (e) => {
    e.preventDefault();
    if (!isValidKeyFormat(keyInput)) {
      setKeyMsg({ ok: false, key: 'keyBadFormat' });
      return;
    }
    if (!saveKey(keyInput)) {
      setKeyMsg({ ok: false, key: 'keyStorageBlocked' });
      return;
    }
    setKeyInput('');
    setEditingKey(false);
    setKeyMsg({ ok: true, key: 'keyUpdated' });
  };

  const cancelEditKey = () => {
    setEditingKey(false);
    setKeyInput('');
    setKeyMsg(null);
  };

  const onRemoveKey = () => {
    if (!window.confirm(y.removeKeyConfirm)) return;
    clearKey();
    setKeyMsg({ ok: true, key: 'keyRemoved' });
  };

  const logout = () => {
    signOut();
    saveLocalAvatar(null);
    router.push('/');
  };

  const total = turns?.limit ?? 10;
  const percent = turns ? Math.min(100, Math.round(((total - turns.remaining) / total) * 100)) : 0;
  const outOfTurns = turns && turns.remaining === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="font-display text-xl font-semibold">{y.profileTitle}</h1>

        {!user ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold">{y.notSignedIn}</p>
            <p className="mt-1 text-sm text-slate-600">{y.notSignedInHint}</p>
            <button
              type="button"
              onClick={() => signIn().catch((err) => setSignInError(err.code ?? 'signInFailed'))}
              className="mx-auto mt-4 inline-flex h-10 items-center gap-2.5 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] hover:shadow-sm"
            >
              <FcGoogle className="h-[18px] w-[18px]" aria-hidden="true" />
              {y.signInWithGoogle}
            </button>
            {signInError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {errorText(y, signInError, y.err.signInFailed)}
              </p>
            )}
          </section>
        ) : (
          <>
            {/* Ảnh đại diện */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={y.changeAvatarLabel}
                  className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-emerald-500/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <FaUserCircle className="h-full w-full text-slate-300" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <FiCamera className="h-6 w-6" aria-hidden="true" />
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{user.email ?? y.googleAccount}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-full border border-slate-300 px-4 text-xs font-semibold hover:bg-slate-100">
                      {y.changeAvatar}
                    </button>
                    {custom && (
                      <button type="button" onClick={onRemoveAvatar} className="h-8 rounded-full px-3 text-xs font-medium text-slate-500 underline hover:text-slate-900">
                        {y.removeAvatar}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {avatarMsg && (
                <p role="status" className={`mt-3 text-sm ${avatarMsg.ok ? 'text-slate-600' : 'text-red-600'}`}>
                  {avatarMsg.code ? errorText(y, avatarMsg.code, y.err.AVATAR_FAILED) : y[avatarMsg.key]}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">{y.avatarNote}</p>
            </section>

            {/* Lượt hôm nay */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="usage-title">
              <h2 id="usage-title" className="text-sm font-semibold text-slate-500">
                {y.turnsCardTitle}
              </h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {turns ? turns.remaining : '–'}
                <span className="text-base font-medium text-slate-500">{y.turnsRemaining(total)}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full transition-all ${outOfTurns ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {outOfTurns ? y.turnsOutPrefix : ''}
                {y.turnsExplain(nextResetLabel())}
              </p>
            </section>

            {/* Key lấy phụ đề */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="key-title">
              <h2 id="key-title" className="text-sm font-semibold text-slate-500">
                {y.keyCardTitle}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{y.keyExplain}</p>
              {hasKey ? (
                <p className="mt-3 font-mono text-sm">{maskedKey}</p>
              ) : (
                <p className="mt-3 text-sm text-slate-600">{y.noKeyYet}</p>
              )}

              {keyOut && (
                <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">{y.keyOutTitle}</p>
                  <p className="mt-0.5 text-xs text-amber-800">{y.keyOutBody(nextResetLabel())}</p>
                  <a
                    href={GET_KEY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-9 items-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    {y.upgrade}
                  </a>
                </div>
              )}

              {hasKey && !editingKey ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(true);
                    setKeyMsg(null);
                  }}
                  className="mt-3 block text-sm font-medium text-emerald-700 underline hover:text-emerald-900"
                >
                  {y.updateKey}
                </button>
              ) : (
                <form onSubmit={onSaveKey} className="mt-4">
                  <label htmlFor="profile-key" className="text-sm font-medium">
                    {hasKey ? y.updateKey : y.enterKey}
                  </label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="profile-key"
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="yta_..."
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus={hasKey}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm focus:border-emerald-500 focus:outline-2 focus:outline-emerald-400/30"
                    />
                    <button type="submit" className="h-10 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:bg-emerald-600">
                      {y.saveKey}
                    </button>
                    {hasKey && (
                      <button type="button" onClick={cancelEditKey} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                        {y.cancel}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {y.noKeyAsk}{' '}
                    <a href={GET_KEY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline">
                      {y.createFreeKey}
                    </a>
                    {y.keyStoredLocally}
                  </p>
                </form>
              )}

              {keyMsg && (
                <p role="status" className={`mt-2 text-sm ${keyMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                  {y[keyMsg.key]}
                </p>
              )}

              {hasKey && !editingKey && (
                <button type="button" onClick={onRemoveKey} className="mt-3 block text-xs font-medium text-slate-500 underline hover:text-red-600">
                  {y.removeKey}
                </button>
              )}
            </section>

            <button type="button" onClick={logout} className="h-10 w-full rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              {y.signOut}
            </button>
          </>
        )}
      </main>

      {notice && <NoticeDialog title={y.noticeTitle} message={errorMessage(y, notice)} okLabel={y.noticeOk} onClose={closeNotice} />}
    </div>
  );
}
