'use client';
import { useEffect, useState } from 'react';
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
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="hidden max-w-48 truncate text-xs text-red-600 md:inline" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={login}
        disabled={busy || !GOOGLE_CLIENT_ID}
        title={GOOGLE_CLIENT_ID ? undefined : 'Đăng nhập Google hiện chưa sẵn sàng'}
        className="h-8 whitespace-nowrap rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        Đăng nhập Google
      </button>
    </div>
  );
}
