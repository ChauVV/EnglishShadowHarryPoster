'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaYoutube } from 'react-icons/fa';
import DeleteLessonButton from '../../components/DeleteLessonButton';
import GoogleAccount from '../../components/GoogleAccount';
import LanguageSwitch from '../../components/LanguageSwitch';
import { authHeader, useGoogleUser } from '../../lib/googleAuth';
import { useGenerateLesson } from '../../lib/useGenerateLesson';
import { useYouTubeLessons } from '../../lib/useYouTubeLessons';

export default function YouTubeHome() {
  const { url, setUrl, error, busy, generate } = useGenerateLesson();
  const user = useGoogleUser();
  const lessons = useYouTubeLessons();
  const [usage, setUsage] = useState(null);

  // Sau khi đăng nhập: lấy số video đã dịch hôm nay
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/youtube/usage', { headers: authHeader(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => !cancelled && u && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Trang chủ
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <GoogleAccount />
            <LanguageSwitch tone="light" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
          <FaYoutube className="h-6 w-6 text-[#FF0000]" aria-hidden="true" />
          Học từ YouTube
        </p>
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
              type="text"
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
                ? `Hôm nay bạn đã dùng ${usage?.used ?? 0}/${usage?.limit ?? 10} lượt dịch. Mỗi video mới tính một lượt, xem lại bài đã tạo không tốn lượt.`
                : 'Bạn cần đăng nhập Google để tạo bài mới. Mỗi người được dịch tối đa 10 video mỗi ngày, bài đã tạo được lưu vào Drive của chính bạn.'}
            </li>
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
                <li key={l.id} className="relative">
                  <Link
                    href={`/youtube/watch?v=${l.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-14 transition hover:border-emerald-400 hover:shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${l.id}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded-lg bg-slate-200 object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold group-hover:text-emerald-700">{l.title}</span>
                      <span className="block text-xs text-slate-500">{l.count} câu</span>
                    </span>
                  </Link>
                  <DeleteLessonButton
                    id={l.id}
                    title={l.title}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 hover:bg-red-600 hover:text-white"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
