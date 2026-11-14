'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Phiên đăng nhập nằm ở cookie -> kiểm tra lại khi tải trang để F5 không bị văng ra
  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => setIsAuth(Boolean(data.admin)))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuth(false);
  };

  const [gemini, setGemini] = useState(null);
  const [geminiChecking, setGeminiChecking] = useState(false);

  // Gọi thử Gemini để biết model còn sống không (key, model đang dùng, thời gian phản hồi)
  const checkGemini = async () => {
    setGeminiChecking(true);
    setGemini(null);
    try {
      const res = await fetch('/api/health/gemini');
      setGemini(await res.json());
    } catch {
      setGemini({ ok: false, problem: 'Không gọi được máy chủ.' });
    }
    setGeminiChecking(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) setIsAuth(true);
    else setError('Tên đăng nhập hoặc mật khẩu không đúng');
  };

  if (checking) return <div className="min-h-screen bg-slate-900" />;

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl w-full max-w-md shadow-lg border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              className="w-full bg-slate-700 border border-slate-600 p-2.5 rounded-lg focus:outline-none focus:border-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-slate-700 border border-slate-600 p-2.5 rounded-lg focus:outline-none focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 py-2.5 rounded-lg font-semibold hover:bg-indigo-500 transition">
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-2xl mx-auto bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <button onClick={handleLogout} className="text-sm text-red-400 hover:underline">
            Đăng xuất
          </button>
        </div>
        <Link href="/" className="mb-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition">
          Xem thư viện bài học →
        </Link>
        <p className="bg-indigo-950/60 p-4 rounded-lg border border-indigo-800/50 text-slate-300">
          📌 Nội dung bài học được tạo bằng script Python tại máy local, sau đó upload lên Google Drive (xem docs/AI_WORKFLOW.md).
        </p>

        <div className="mt-4 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Gemini (dịch phụ đề YouTube)</p>
              <p className="text-xs text-slate-400">Kiểm tra key và model còn hoạt động không.</p>
            </div>
            <button
              type="button"
              onClick={checkGemini}
              disabled={geminiChecking}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition"
            >
              {geminiChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </button>
          </div>
          {gemini && (
            <p className={`mt-3 text-sm ${gemini.ok ? 'text-emerald-300' : 'text-red-300'}`} role="status">
              {gemini.ok
                ? `Hoạt động tốt. Model: ${gemini.model} · phản hồi ${gemini.ms} ms`
                : `Có vấn đề: ${gemini.problem}${gemini.model ? ` (model ${gemini.model}${gemini.status ? `, mã ${gemini.status}` : ''})` : ''}`}
              {!gemini.ok && gemini.detail ? <span className="mt-1 block text-xs text-slate-400">{gemini.detail}</span> : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
