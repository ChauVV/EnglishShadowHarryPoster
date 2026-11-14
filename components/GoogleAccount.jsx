'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { saveLocalAvatar, useAvatar } from '../lib/avatar';
import { GOOGLE_CLIENT_ID, ensureSession, preloadGoogle, signIn, signOut, useGoogleUser } from '../lib/googleAuth';

// Nút tài khoản ở header: chỉ hiện ảnh đại diện (hoặc icon người dùng). Bấm vào mở hộp nhỏ:
// đã đăng nhập -> email + Trang cá nhân + Đăng xuất; chưa đăng nhập -> nút Đăng nhập bằng Google.
export default function GoogleAccount() {
  const user = useGoogleUser();
  const { src } = useAvatar();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  // Nạp sẵn thư viện Google (để bấm đăng nhập mở được cửa sổ ngay) và thử khôi phục phiên im lặng
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    preloadGoogle().catch(() => {});
    ensureSession();
  }, []);

  // Đóng hộp khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const login = async () => {
    setError('');
    setBusy(true);
    const session = await signIn().catch((err) => {
      setError(err.message);
      return null;
    });
    setBusy(false);
    if (session) setOpen(false);
    else setError((prev) => prev || 'Chưa đăng nhập được.');
  };

  const logout = () => {
    signOut();
    saveLocalAvatar(null); // máy dùng chung: không để lại ảnh của người vừa đăng xuất
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tài khoản"
        aria-haspopup="true"
        aria-expanded={open}
        title={user?.email ?? 'Tài khoản'}
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 ${
          user ? 'text-emerald-600' : 'text-slate-500'
        }`}
      >
        {user && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500/40" />
        ) : (
          <FaUserCircle className="h-7 w-7" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-lg">
          {user ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Đã đăng nhập</p>
              <p className="mt-1 break-all text-sm font-medium">{user.email ?? 'Tài khoản Google'}</p>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="mt-3 flex h-9 w-full items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Trang cá nhân
              </Link>
              <button
                type="button"
                onClick={logout}
                className="mt-2 h-9 w-full rounded-full border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">Đăng nhập để tạo bài học và lưu bài vào Drive của bạn.</p>
              <button
                type="button"
                onClick={login}
                disabled={busy}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-[#dadce0] bg-white text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] hover:shadow-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4]"
              >
                <FcGoogle className="h-[18px] w-[18px]" aria-hidden="true" />
                Đăng nhập bằng Google
              </button>
              {error && (
                <p role="alert" className="mt-2 text-xs leading-snug text-red-600">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
