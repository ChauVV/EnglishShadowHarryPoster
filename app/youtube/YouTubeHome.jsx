'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LanguageSwitch from '../../components/LanguageSwitch';
import { findLesson, listLessons } from '../../lib/driveSync';
import { GOOGLE_CLIENT_ID, authHeader, ensureSession, getSession, preloadGoogle, signIn, signOut, useGoogleUser } from '../../lib/googleAuth';
import { extractVideoId } from '../../lib/youtube';
import { getKey, isValidKeyFormat, loadLesson, nextResetLabel, useLessonIndex, useQuota } from '../../lib/ytClient';

export default function YouTubeHome() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const user = useGoogleUser();
  const quota = useQuota();
  const localLessons = useLessonIndex();
  const [driveLessons, setDriveLessons] = useState([]);
  const [usage, setUsage] = useState(null);

  // Nạp sẵn thư viện Google (để bấm Generate mở được cửa sổ đăng nhập ngay) và thử đăng nhập lại im lặng
  useEffect(() => {
    preloadGoogle().catch(() => {});
    ensureSession();
  }, []);

  // Sau khi đăng nhập: lấy danh sách bài trong Drive và số video đã dịch hôm nay
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    if (user.drive) {
      listLessons(user.token)
        .then((list) => !cancelled && setDriveLessons(list))
        .catch(() => {});
    }
    fetch('/api/youtube/usage', { headers: authHeader(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => !cancelled && u && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Gộp bài trên máy và bài trong Drive, mới nhất lên đầu
  const lessons = useMemo(() => {
    const byId = new Map();
    for (const l of localLessons) byId.set(l.id, { id: l.id, title: l.title, count: l.count, savedAt: l.savedAt });
    if (user) {
      for (const d of driveLessons) {
        const have = byId.get(d.videoId);
        if (!have || d.savedAt > have.savedAt) byId.set(d.videoId, { id: d.videoId, title: d.title, count: d.count, savedAt: d.savedAt });
      }
    }
    return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
  }, [localLessons, driveLessons, user]);

  const login = async () => {
    setError('');
    setBusy(true);
    const session = await signIn().catch((err) => {
      setError(err.message);
      return null;
    });
    setBusy(false);
    if (!session) setError((prev) => prev || 'Chưa đăng nhập được Google. Hãy thử lại.');
  };

  const generate = async (e) => {
    e.preventDefault();
    const id = extractVideoId(url);
    if (!id) {
      setError('Link YouTube không hợp lệ. Hãy dán link dạng youtube.com/watch?v=... hoặc youtu.be/...');
      return;
    }
    setError('');
    const watch = `/youtube/watch?v=${id}`;
    // Bài đã có trên máy: xem lại ngay, không cần đăng nhập, không cần key, không tốn lượt
    if (loadLesson(id)) return router.push(watch);

    // Chưa đăng nhập: mở cửa sổ đăng nhập Google (gọi ngay trong sự kiện bấm nút)
    let session = getSession();
    if (!session) {
      if (!GOOGLE_CLIENT_ID) return setError('Chưa cấu hình đăng nhập Google (NEXT_PUBLIC_GOOGLE_CLIENT_ID).');
      setBusy(true);
      session = await signIn().catch((err) => {
        setError(err.message);
        return null;
      });
      setBusy(false);
      if (!session) return setError((prev) => prev || 'Chưa đăng nhập được Google. Hãy thử lại.');
    }

    // Bài đã tạo trên thiết bị khác (có trong Drive): mở thẳng, không cần key
    if (session.drive && (await findLesson(session.token, id).catch(() => null))) return router.push(watch);

    router.push(isValidKeyFormat(getKey()) ? watch : `/youtube/key?v=${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Trang chủ
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden sm:inline max-w-48 truncate text-xs text-slate-600">{user.email}</span>
                <button type="button" onClick={signOut} className="text-xs font-medium text-slate-500 underline hover:text-slate-900">
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={login}
                disabled={busy}
                className="h-8 rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60 transition"
              >
                Đăng nhập Google
              </button>
            )}
            <LanguageSwitch tone="light" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Học từ YouTube</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Biến video yêu thích thành bài học</h1>
        <p className="mt-2 text-slate-600">
          Dán link YouTube có phụ đề tiếng Anh. Ứng dụng lấy phụ đề, chia thành câu và dịch sang tiếng Việt để bạn luyện shadowing ngay trên video.
        </p>

        <form onSubmit={generate} className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label htmlFor="yt-url" className="text-sm font-medium">
            Link YouTube
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="yt-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-2 focus:outline-emerald-400/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              Generate
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            <li>
              {user
                ? `Hôm nay bạn đã dịch ${usage?.used ?? 0}/${usage?.limit ?? 10} video (làm mới lúc ${nextResetLabel()}). Xem lại bài đã tạo không tốn lượt.`
                : 'Bạn cần đăng nhập Google để tạo bài mới. Mỗi người được dịch tối đa 10 video mỗi ngày, bài đã tạo được lưu vào Drive của chính bạn.'}
            </li>
            {user && (
              <li>
                Lượt lấy phụ đề (key của bạn): đã dùng {quota.used}/{quota.limit} hôm nay.
              </li>
            )}
            {user && !user.drive && (
              <li className="text-amber-700">Bạn chưa cấp quyền Drive nên bài chỉ lưu trên máy này. Đăng xuất rồi đăng nhập lại và tick quyền lưu dữ liệu ứng dụng.</li>
            )}
          </ul>
        </form>

        {lessons.length > 0 && (
          <section className="mt-10" aria-labelledby="recent-title">
            <h2 id="recent-title" className="font-display text-xl font-semibold">
              Bài đã tạo
            </h2>
            <ul className="mt-3 grid gap-2">
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/youtube/watch?v=${l.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4 transition hover:border-emerald-400 hover:shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${l.id}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded-lg bg-slate-200 object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold group-hover:text-emerald-700">{l.title}</span>
                      <span className="block text-xs text-slate-500">{l.count} câu</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
