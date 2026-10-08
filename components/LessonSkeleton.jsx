'use client';
import { useI18n } from '../lib/i18n';

// Khung chờ cùng bố cục với ShadowingPlayer: header, khung audio + thanh điều khiển, danh sách phụ đề
const bar = 'rounded-full bg-slate-200';

export default function LessonSkeleton() {
  const { t } = useI18n();
  return (
    // Nền giữ đặc (không pulse), nếu không nền tối của body lộ ra khi pulse mờ đi
    <div className="min-h-screen bg-slate-50 [&>header]:animate-pulse [&>main]:animate-pulse" role="status" aria-busy="true">
      <span className="sr-only">{t.loadingLesson}</span>

      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-4">
          <div className="h-9 w-9 rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-56 max-w-full ${bar}`} />
            <div className={`h-3 w-32 ${bar}`} />
          </div>
          <div className="hidden h-9 w-24 rounded-full border border-slate-200 sm:block" />
          <div className="hidden h-9 w-28 rounded-full border border-slate-200 sm:block" />
          <div className="hidden h-9 w-28 rounded-full border border-slate-200 sm:block" />
          <div className="h-9 w-20 rounded-full bg-slate-200" />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_680px]">
        <section className="min-w-0 space-y-4">
          <div className="mx-auto aspect-video max-h-[60vh] max-w-[calc(60vh*16/9)] w-full rounded-2xl bg-slate-200" />
          <div className="mx-auto flex h-28 w-full max-w-[calc(60vh*16/9)] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
            <div className={`h-3 w-16 ${bar}`} />
            <div className={`h-5 w-64 max-w-[70%] ${bar}`} />
            <div className={`h-4 w-48 max-w-[55%] ${bar}`} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[10, 10, 12, 10, 24, 28, 28, 24].map((w, i) => (
              <div key={i} className={`h-10 rounded-full ${i === 2 ? 'bg-slate-300' : 'border border-slate-200 bg-white'}`} style={{ width: `${w * 4}px` }} />
            ))}
          </div>
        </section>

        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-4 lg:block">
          <div className="mb-4 flex items-center justify-between">
            <div className={`h-4 w-20 ${bar}`} />
            <div className={`h-3 w-14 ${bar}`} />
          </div>
          <ul className="space-y-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex gap-3">
                <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-slate-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className={`h-2.5 w-12 ${bar}`} />
                  <div className={`h-4 ${bar}`} style={{ width: `${88 - (i % 3) * 12}%` }} />
                  <div className={`h-3 ${bar} opacity-70`} style={{ width: `${70 - (i % 2) * 15}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
