'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { FiCamera, FiHome } from 'react-icons/fi';
import { prepareAvatar, saveLocalAvatar, useAvatar } from '../../lib/avatar';
import { deleteAvatar, uploadAvatar } from '../../lib/driveSync';
import { authHeader, ensureSession, signIn, signOut, useGoogleUser } from '../../lib/googleAuth';
import { GET_KEY_URL, clearKey, isValidKeyFormat, nextResetLabel, saveKey, useQuota, useStoredKey, useTurnsLeft } from '../../lib/ytClient';

export default function ProfileClient() {
  const router = useRouter();
  const user = useGoogleUser();
  const { src, custom } = useAvatar();
  const quota = useQuota();
  const storedKey = useStoredKey();
  const fileRef = useRef(null);
  const [usage, setUsage] = useState(null);
  const turns = useTurnsLeft(usage); // một con số duy nhất: số nhỏ hơn giữa lượt của key và giới hạn của app
  const [avatarMsg, setAvatarMsg] = useState(null); // { ok, text }
  const [keyInput, setKeyInput] = useState('');
  const [keyMsg, setKeyMsg] = useState(null); // { ok, text }
  const [signInError, setSignInError] = useState('');

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
    setAvatarMsg({ ok: true, text: 'Đang lưu ảnh...' });
    let prepared;
    try {
      prepared = await prepareAvatar(file);
    } catch (err) {
      setAvatarMsg({ ok: false, text: err.message || 'Không xử lý được ảnh này.' });
      return;
    }
    saveLocalAvatar(prepared.dataUrl); // đổi ngay trên máy này
    if (!user.drive) {
      setAvatarMsg({ ok: true, text: 'Đã đổi ảnh trên máy này. Ảnh chưa được lưu vào Drive vì bạn chưa cấp quyền Drive khi đăng nhập.' });
      return;
    }
    try {
      await uploadAvatar(user.token, prepared.blob);
      setAvatarMsg({ ok: true, text: 'Đã lưu ảnh vào Drive của bạn.' });
    } catch {
      setAvatarMsg({ ok: false, text: 'Đã đổi ảnh trên máy này nhưng chưa lưu được vào Drive. Hãy thử lại khi có mạng.' });
    }
  };

  const onRemoveAvatar = async () => {
    saveLocalAvatar(null);
    setAvatarMsg({ ok: true, text: 'Đã xóa ảnh.' });
    if (user?.drive) {
      try {
        await deleteAvatar(user.token);
      } catch {
        setAvatarMsg({ ok: false, text: 'Đã xóa ảnh trên máy này nhưng chưa xóa được bản trong Drive. Hãy thử lại khi có mạng.' });
      }
    }
  };

  const onSaveKey = (e) => {
    e.preventDefault();
    if (!isValidKeyFormat(keyInput)) {
      setKeyMsg({ ok: false, text: 'Key không đúng định dạng. Key hợp lệ bắt đầu bằng "yta_". Hãy sao chép lại đầy đủ.' });
      return;
    }
    if (!saveKey(keyInput)) {
      setKeyMsg({ ok: false, text: 'Trình duyệt đang chặn lưu dữ liệu nên không lưu được key.' });
      return;
    }
    setKeyInput('');
    setKeyMsg({ ok: true, text: 'Đã cập nhật key.' });
  };

  const onRemoveKey = () => {
    if (!window.confirm('Xóa key khỏi trình duyệt này? Bài đã tạo vẫn xem được bình thường.')) return;
    clearKey();
    setKeyMsg({ ok: true, text: 'Đã xóa key.' });
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
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link href="/" aria-label="Trang chủ" title="Trang chủ" className="-ml-2 rounded-full p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500">
            <FiHome className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h1 className="font-display text-base font-semibold">Tài khoản</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {!user ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold">Bạn chưa đăng nhập</p>
            <p className="mt-1 text-sm text-slate-600">Đăng nhập để xem tài khoản, số lượt dịch và quản lý key.</p>
            <button
              type="button"
              onClick={() => signIn().catch((err) => setSignInError(err.message))}
              className="mx-auto mt-4 inline-flex h-10 items-center gap-2.5 rounded-full border border-[#dadce0] bg-white px-5 text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] hover:shadow-sm"
            >
              <FcGoogle className="h-[18px] w-[18px]" aria-hidden="true" />
              Đăng nhập bằng Google
            </button>
            {signInError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {signInError}
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
                  aria-label="Đổi ảnh đại diện"
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
                  <p className="truncate text-lg font-semibold">{user.email ?? 'Tài khoản Google'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-full border border-slate-300 px-4 text-xs font-semibold hover:bg-slate-100">
                      Đổi ảnh
                    </button>
                    {custom && (
                      <button type="button" onClick={onRemoveAvatar} className="h-8 rounded-full px-3 text-xs font-medium text-slate-500 underline hover:text-slate-900">
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {avatarMsg && (
                <p role="status" className={`mt-3 text-sm ${avatarMsg.ok ? 'text-slate-600' : 'text-red-600'}`}>
                  {avatarMsg.text}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">Ảnh được lưu trong thư mục riêng của ứng dụng trong Drive của bạn.</p>
            </section>

            {/* Lượt hôm nay */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="usage-title">
              <h2 id="usage-title" className="text-sm font-semibold text-slate-500">
                Lượt hôm nay
              </h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {turns ? turns.remaining : '–'}
                <span className="text-base font-medium text-slate-500"> / {total} lượt còn lại</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full transition-all ${outOfTurns ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {outOfTurns ? 'Bạn đã hết lượt hôm nay. ' : ''}Mỗi video mới tính một lượt, xem lại bài đã tạo không tốn lượt. Lượt được làm mới lúc {nextResetLabel()}.
              </p>
            </section>

            {/* Key lấy phụ đề */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="key-title">
              <h2 id="key-title" className="text-sm font-semibold text-slate-500">
                Key lấy phụ đề
              </h2>
              {hasKey ? (
                <>
                  <p className="mt-1 font-mono text-sm">{maskedKey}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Bạn chưa có key. Cần một key miễn phí để lấy phụ đề cho video mới.</p>
              )}

              {keyOut && (
                <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">Key đã hết lượt lấy phụ đề hôm nay.</p>
                  <p className="mt-0.5 text-xs text-amber-800">Nâng cấp để có nhiều lượt hơn, rồi dán key mới vào ô bên dưới. Lượt miễn phí được làm mới lúc {nextResetLabel()}.</p>
                  <a
                    href={GET_KEY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-9 items-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    Nâng cấp ↗
                  </a>
                </div>
              )}

              <form onSubmit={onSaveKey} className="mt-4">
                <label htmlFor="profile-key" className="text-sm font-medium">
                  {hasKey ? 'Cập nhật key mới' : 'Nhập key'}
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
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm focus:border-emerald-500 focus:outline-2 focus:outline-emerald-400/30"
                  />
                  <button type="submit" className="h-10 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Lưu key
                  </button>
                </div>
                {keyMsg && (
                  <p role="status" className={`mt-2 text-sm ${keyMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {keyMsg.text}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Chưa có key?{' '}
                  <a href={GET_KEY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline">
                    Tạo key miễn phí ↗
                  </a>
                  . Key chỉ lưu trong trình duyệt của bạn.
                </p>
              </form>
              {hasKey && (
                <button type="button" onClick={onRemoveKey} className="mt-3 text-xs font-medium text-slate-500 underline hover:text-red-600">
                  Xóa key khỏi trình duyệt này
                </button>
              )}
            </section>

            <button type="button" onClick={logout} className="h-10 w-full rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Đăng xuất
            </button>
          </>
        )}
      </main>
    </div>
  );
}
