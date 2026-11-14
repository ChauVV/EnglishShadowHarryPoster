'use client';
import { useEffect, useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { GOOGLE_CLIENT_ID, ensureSession, preloadGoogle, signIn, signOut, useGoogleUser } from '../lib/googleAuth';

// Nút đăng nhập Google dùng chung cho header: chưa đăng nhập thì hiện nút, đã đăng nhập thì hiện email + Đăng xuất.
export default function GoogleAccount() {
  const user = useGoogleUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Nạp sẵn thư viện Google (để bấm nút mở được cửa sổ đăng nhập ngay) và thử khôi phục phiên im lặng
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    preloadGoogle().catch(() => {});
    ensureSession();
  }, []);

  const login = async () => {
    setError('');
    setBusy(true);
    const session = await signIn().catch((err) => {
      setError(err.message);
      return null;
    });
    setBusy(false);
    if (!session) setError((prev) => prev || 'Chưa đăng nhập được.');
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-44 truncate text-xs text-slate-600 md:inline" title={user.email ?? ''}>
          {user.email}
        </span>
        <button type="button" onClick={signOut} className="text-xs font-medium text-slate-500 underline hover:text-slate-900">
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2.5 whitespace-nowrap rounded-full border border-[#dadce0] bg-white pl-3 pr-4 text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] hover:shadow-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4]"
      >
        <FcGoogle className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="hidden sm:inline">Đăng nhập bằng Google</span>
        <span className="sm:hidden">Đăng nhập</span>
      </button>
      {error && (
        <p role="alert" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-red-200 bg-white p-3 text-xs leading-snug text-red-700 shadow-lg">
          {error}
        </p>
      )}
    </div>
  );
}
