'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import LanguageSwitch from '../components/LanguageSwitch';
import TopicIcon from '../components/TopicIcon';
import { BOOKS } from '../lib/books';
import { lessonLabel, useI18n } from '../lib/i18n';
import { formatTime } from '../lib/sentences';
import { topicCoverSrc } from '../lib/topicCovers';
import { markTopicLessonOpened, topicLessonKey, useTopicProgress } from '../lib/topicProgress';

const PROGRESS_KEY = 'hp-shadowing-progress';

// Mỗi tập một màu bìa riêng để dễ nhận biết trên "kệ sách"
const COVERS = [
  'from-red-800 via-red-700 to-amber-500',
  'from-emerald-900 via-emerald-700 to-lime-500',
  'from-slate-900 via-indigo-800 to-sky-500',
  'from-amber-700 via-orange-600 to-yellow-400',
  'from-fuchsia-900 via-purple-700 to-rose-400',
  'from-teal-900 via-cyan-700 to-emerald-400',
  'from-zinc-900 via-stone-700 to-amber-600',
];

// ---- tiến độ học lưu trên trình duyệt (các bài đã mở + bài mở gần nhất) ----
function subscribeProgress(callback) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
const readProgressRaw = () => {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
};

function useProgress() {
  const raw = useSyncExternalStore(subscribeProgress, readProgressRaw, () => null);
  return useMemo(() => {
    try {
      const parsed = JSON.parse(raw ?? '{}');
      return { visited: new Set(parsed.visited ?? []), last: parsed.last ?? null };
    } catch {
      return { visited: new Set(), last: null };
    }
  }, [raw]);
}

function markOpened(key) {
  try {
    const parsed = JSON.parse(readProgressRaw() ?? '{}');
    const visited = new Set(parsed.visited ?? []);
    visited.add(key);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ visited: [...visited], last: key }));
  } catch {
    // localStorage bị chặn -> bỏ qua, chỉ mất tính năng nhớ tiến độ
  }
}

const lessonKey = (book, chapter, lesson) => `${book}/${chapter}/${lesson}`;
const lessonHref = (key) => `/learn/${key}`;
const minutes = (seconds) => Math.max(1, Math.round(seconds / 60));

// Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt ("ngan hang" khớp "Ngân hàng")
const normalizeText = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

export default function LibraryPage() {
  const { t } = useI18n();
  const [library, setLibrary] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const progress = useProgress();

  useEffect(() => {
    fetch('/api/lessons')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        setIsAdmin(Boolean(data.admin));
        setLibrary(data.books);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    fetch('/api/topics')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setTopics(data.topics))
      .catch(() => setTopics([]));
  }, []);

  const chaptersByBook = useMemo(
    () => new Map((library ?? []).map((b) => [b.book_number, b.chapters])),
    [library],
  );

  // Phẳng hóa toàn bộ bài học để tính thống kê / tìm "bài tiếp theo"
  const allLessons = useMemo(() => {
    const list = [];
    for (const book of BOOKS) {
      for (const chapter of chaptersByBook.get(book.id) ?? []) {
        for (const lesson of chapter.lessons) {
          list.push({
            key: lessonKey(book.id, chapter.chapter_number, lesson.lesson_index),
            book,
            chapter,
            lesson,
          });
        }
      }
    }
    return list;
  }, [chaptersByBook]);

  const totalMinutes = Math.round(allLessons.reduce((sum, l) => sum + l.lesson.duration_seconds, 0) / 60);
  const doneCount = allLessons.filter((l) => progress.visited.has(l.key)).length;

  const lastEntry = allLessons.find((l) => l.key === progress.last);
  const nextEntry =
    allLessons[allLessons.findIndex((l) => l.key === progress.last) + 1] ??
    allLessons.find((l) => !progress.visited.has(l.key)) ??
    allLessons[0];
  const startEntry = lastEntry ? nextEntry : allLessons[0];

  const firstOpenBook = BOOKS.find((b) => (chaptersByBook.get(b.id) ?? []).length > 0)?.id ?? 1;
  const activeId = selectedId ?? firstOpenBook;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar query={query} onQueryChange={setQuery} />

      <Hero
        loaded={Boolean(library)}
        bookCount={chaptersByBook.size}
        lessonCount={allLessons.length}
        totalMinutes={totalMinutes}
        startEntry={startEntry}
        continuing={Boolean(lastEntry)}
        hasTopics={topics?.length > 0}
      />

      <main className="flex-1 px-4 pb-10 sm:px-6">
        {error && (
          <p className="mt-8 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {t.loadError}
          </p>
        )}

        {!library && !error && <LibrarySkeleton />}

        {topics?.length > 0 && <TopicsSection topics={topics} query={query} onClearQuery={() => setQuery('')} />}

        {library && topics && !isAdmin && topics.length === 0 && <FreeTopicsPlaceholder />}

        {library && isAdmin && (
          <>
            {lastEntry && (
              <ContinueCard
                entry={lastEntry}
                next={nextEntry}
                done={doneCount}
                total={allLessons.length}
              />
            )}

            <section className="mt-12" aria-labelledby="shelf-title">
              <SectionHeading
                id="shelf-title"
                eyebrow={t.library}
                title={t.pickBook}
                note={t.booksAvailable(chaptersByBook.size, BOOKS.length)}
              />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {BOOKS.map((book, i) => {
                    const chapters = chaptersByBook.get(book.id) ?? [];
                    const lessons = chapters.flatMap((c) => c.lessons.map((l) => lessonKey(book.id, c.chapter_number, l.lesson_index)));
                    return (
                      <BookCover
                        key={book.id}
                        book={book}
                        gradient={COVERS[i % COVERS.length]}
                        active={book.id === activeId}
                        chapterCount={chapters.length}
                        lessonCount={lessons.length}
                        doneCount={lessons.filter((k) => progress.visited.has(k)).length}
                        onSelect={() => setSelectedId(book.id)}
                      />
                    );
                  })}
              </div>
            </section>

            <BookPanel
              key={activeId}
              lastKey={progress.last}
              book={BOOKS.find((b) => b.id === activeId)}
              gradient={COVERS[(activeId - 1) % COVERS.length]}
              chapters={chaptersByBook.get(activeId) ?? []}
              visited={progress.visited}
            />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="px-4 py-6 text-xs text-slate-500 sm:px-6">
          {t.footer}
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TopBar({ query, onQueryChange }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
          <HeadphonesIcon className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline font-display font-semibold tracking-tight text-slate-900">{t.brand}</span>

        <label className="relative min-w-0 flex-1 sm:ml-4 sm:max-w-xl">
          <span className="sr-only">{t.searchLabel}</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onQueryChange('')}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            className="h-9 w-full rounded-full border border-transparent bg-slate-100 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition [&::-webkit-search-cancel-button]:hidden focus:border-emerald-400 focus:bg-white focus:outline-2 focus:outline-emerald-400/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={t.clearSearch}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <div className="shrink-0 sm:ml-auto">
          <LanguageSwitch tone="light" />
        </div>
      </div>
    </header>
  );
}

// Banner mỏng một hàng: tiêu đề + số liệu nhanh + nút học tiếp
function Hero({ loaded, bookCount, lessonCount, totalMinutes, startEntry, continuing, hasTopics }) {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 120% at 85% 0%, rgba(16,185,129,.35), transparent 60%), radial-gradient(40% 100% at 0% 100%, rgba(245,158,11,.22), transparent 60%)',
        }}
      />
      <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">{t.eyebrow}</p>
          <h1 className="font-display text-xl sm:text-2xl font-semibold leading-tight tracking-tight">{t.heroLine1}</h1>
        </div>

        {!(loaded && lessonCount === 0) && (
          <dl className="hidden md:flex gap-6">
            <Stat value={loaded ? bookCount : '–'} label={t.statBooks} />
            <Stat value={loaded ? lessonCount : '–'} label={t.statLessons} />
            <Stat value={loaded ? totalMinutes : '–'} label={t.statMinutes} />
          </dl>
        )}

        {startEntry ? (
          <Link
            href={lessonHref(startEntry.key)}
            onClick={() => markOpened(startEntry.key)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 h-10 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            {continuing ? t.nextLesson : t.startLearning}
          </Link>
        ) : (
          !hasTopics && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-5 h-10 text-sm text-slate-300">
              {loaded ? t.noLessons : t.loading}
            </span>
          )
        )}
      </div>
    </section>
  );
}

// Topic miễn phí: hàng tag chủ đề (lọc) + mỗi topic là một nhóm có tiêu đề, bên dưới là hàng lesson cuộn ngang (kiểu Corodomo)
function TopicsSection({ topics, query, onClearQuery }) {
  const { t } = useI18n();
  const [tag, setTag] = useState(null); // slug topic đang chọn, null = tất cả

  const visible = useMemo(() => {
    const q = normalizeText(query);
    const result = [];
    for (const topic of topics) {
      if (tag && topic.topic !== tag) continue;
      if (!q) {
        result.push({ topic, lessons: topic.lessons });
        continue;
      }
      // Khớp tên topic -> hiện cả topic; không thì chỉ giữ các bài có tên khớp
      const topicMatch = normalizeText(`${topic.title} ${topic.title_vi ?? ''}`).includes(q);
      const lessons = topicMatch ? topic.lessons : topic.lessons.filter((l) => normalizeText(lessonLabel(l.title)).includes(q));
      if (lessons.length > 0) result.push({ topic, lessons });
    }
    return result;
  }, [topics, tag, query]);

  return (
    <section className="mt-4" aria-label={t.topicsTitle}>
      <TopicTags topics={topics} tag={tag} onSelect={setTag} />

      <div className="mt-4" />

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold">{t.noResults}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{t.noResultsDesc}</p>
          <button
            type="button"
            onClick={() => {
              onClearQuery();
              setTag(null);
            }}
            className="mt-4 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            {t.clearFilters}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(({ topic, lessons }) => (
            <TopicRow key={topic.topic} topic={topic} lessons={lessons} gradient={COVERS[(topic.number - 1) % COVERS.length]} />
          ))}
        </div>
      )}
    </section>
  );
}

// Màu tag: nền pastel + viền nhạt + chữ/icon cùng tông đậm; tag đang chọn đổi sang nền đặc, chữ trắng
const TAG_COLORS = [
  { idle: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100', active: 'border-emerald-600 bg-emerald-600' },
  { idle: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100', active: 'border-sky-600 bg-sky-600' },
  { idle: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100', active: 'border-violet-600 bg-violet-600' },
  { idle: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100', active: 'border-amber-600 bg-amber-600' },
  { idle: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100', active: 'border-rose-600 bg-rose-600' },
  { idle: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100', active: 'border-teal-600 bg-teal-600' },
  { idle: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100', active: 'border-indigo-600 bg-indigo-600' },
  { idle: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100', active: 'border-orange-600 bg-orange-600' },
  { idle: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100', active: 'border-pink-600 bg-pink-600' },
  { idle: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100', active: 'border-cyan-600 bg-cyan-600' },
];
const TAG_ALL_COLOR = { idle: 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200', active: 'border-slate-700 bg-slate-700' };

// Hàng tag chủ đề cuộn ngang, dính dưới header khi cuộn trang
function TopicTags({ topics, tag, onSelect }) {
  const { t } = useI18n();
  const items = [
    { slug: null, label: t.allTopics, icon: 'all', color: TAG_ALL_COLOR },
    ...topics.map((tp) => ({
      slug: tp.topic,
      label: tp.title,
      icon: tp.number,
      color: TAG_COLORS[(tp.number - 1) % TAG_COLORS.length],
    })),
  ];
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200/70 bg-slate-50/90 px-4 py-2.5 sm:-mx-6 sm:px-6 backdrop-blur">
      <ul
        role="group"
        aria-label={t.topicTags}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.slug === tag;
          return (
            <li key={item.slug ?? 'all'} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item.slug)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500 ${
                  active ? `${item.color.active} font-semibold text-white shadow-sm` : item.color.idle
                }`}
              >
                <TopicIcon number={item.icon} className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopicRow({ topic, lessons, gradient }) {
  const { t } = useI18n();
  const visited = useTopicProgress();
  const scroller = useRef(null);
  const total = topic.lessons.length;
  const done = topic.lessons.filter((l) => visited.has(topicLessonKey(topic.topic, l.lesson_index))).length;
  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div id={`topic-${topic.topic}`} className="scroll-mt-28">
      <div className="mb-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg sm:text-xl font-semibold leading-tight truncate">{topic.title}</h3>
          <p className="text-xs text-slate-500 truncate">
            {topic.title_vi && <span>{topic.title_vi} · </span>}
            {t.topicLessons(done, total)}
          </p>
        </div>
        <div className="hidden sm:flex gap-1.5">
          <ScrollButton onClick={() => scrollBy(-1)} label="←" flip />
          <ScrollButton onClick={() => scrollBy(1)} label="→" />
        </div>
      </div>

      <ul
        ref={scroller}
        className="-mx-1 flex snap-x scroll-px-1 gap-3 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lessons.map((lesson) => {
          const key = topicLessonKey(topic.topic, lesson.lesson_index);
          return (
            <LessonCard
              key={lesson.lesson_index}
              lesson={lesson}
              gradient={gradient}
              coverSrc={topicCoverSrc(topic.topic, lesson.lesson_index)}
              done={visited.has(key)}
              href={`/topic/${encodeURIComponent(topic.topic)}/${lesson.lesson_index}`}
              onOpen={() => markTopicLessonOpened(key)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function LessonCard({ lesson, gradient, coverSrc, done, href, onOpen }) {
  const { t } = useI18n();
  const [coverFailed, setCoverFailed] = useState(false); // topic chưa có ảnh bìa -> dùng ô gradient + số bài
  return (
    <li className="w-44 sm:w-52 shrink-0 snap-start">
      <Link
        href={href}
        onClick={onOpen}
        className="group block rounded-xl focus-visible:outline-none"
      >
        <span className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-sm transition group-hover:shadow-md group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-slate-50 ${gradient}`}>
          {coverFailed ? (
            <span className="font-display text-5xl font-semibold opacity-90 drop-shadow">{lesson.lesson_index}</span>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" loading="lazy" onError={() => setCoverFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-1.5 bottom-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/60 px-1.5 text-[11px] font-semibold tabular-nums">
                {lesson.lesson_index}
              </span>
            </>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
            <PlayIcon className="h-8 w-8" />
          </span>
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums">
            <ClockIcon className="h-3 w-3" />
            {formatTime(lesson.duration_seconds)}
          </span>
          {done && (
            <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white" title={t.studied}>
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        <span className="mt-2 block text-sm font-semibold leading-snug line-clamp-2 group-hover:text-emerald-700">{lessonLabel(lesson.title)}</span>
      </Link>
    </li>
  );
}

function ScrollButton({ onClick, label, flip }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={flip ? 'Scroll left' : 'Scroll right'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500"
    >
      <ArrowIcon className={`h-4 w-4 ${flip ? 'rotate-180' : ''}`} />
    </button>
  );
}

// Khách chưa đăng nhập admin: không có nội dung nào để hiển thị (Harry Potter chỉ dành cho admin)
function FreeTopicsPlaceholder() {
  const { t } = useI18n();
  return (
    <section className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" aria-labelledby="shelf-title">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{t.library}</p>
      <h2 id="shelf-title" className="font-display mt-2 text-2xl font-semibold">{t.freeTopicsTitle}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t.freeTopicsDesc}</p>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="border-l-2 border-emerald-400/60 pl-3">
      <dd className="font-display text-xl font-semibold leading-tight tabular-nums">{value}</dd>
      <dt className="text-xs text-slate-400">{label}</dt>
    </div>
  );
}

function ContinueCard({ entry, next, done, total }) {
  const { t } = useI18n();
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <section className="-mt-7 relative z-10 rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-900/5 p-5 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{t.lastStudied}</p>
        <p className="mt-1 font-semibold truncate">
          Book {entry.book.id} · Chapter {entry.chapter.chapter_number} · {lessonLabel(entry.lesson.title)}
        </p>
        <p className="text-sm text-slate-500 truncate">{entry.chapter.chapter_title}</p>
      </div>

      <div className="sm:w-56">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{t.progress}</span>
          <span className="tabular-nums">{t.lessonsDone(done, total)}</span>
        </div>
        <ProgressBar percent={percent} />
      </div>

      <div className="flex gap-2">
        <Link
          href={lessonHref(entry.key)}
          className="inline-flex items-center justify-center h-11 px-4 rounded-full border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
        >
          {t.review}
        </Link>
        {next && next.key !== entry.key && (
          <Link
            href={lessonHref(next.key)}
            onClick={() => markOpened(next.key)}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
          >
            {t.nextShort}
            <ArrowIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

function SectionHeading({ id, eyebrow, title, note }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">{eyebrow}</p>}
        <h2 id={id} className="font-display mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {note && <p className="text-sm text-slate-500">{note}</p>}
    </div>
  );
}

// Ảnh bìa lấy từ public/covers/book_N.jpg; tập nào chưa có file thì dùng ô gradient
function CoverImage({ book, gradient, className = '', children }) {
  const [hasCover, setHasCover] = useState(true);
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden bg-gradient-to-br ${gradient} text-white ${className}`}
    >
      {hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/covers/book_${book.id}.jpg`}
          alt={`Book ${book.id} - ${book.title}`}
          loading="lazy"
          onError={() => setHasCover(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <div className="absolute inset-y-0 left-0 w-2 bg-black/20" aria-hidden="true" />
          <span className="font-display text-5xl font-semibold leading-none opacity-90 pl-1">{book.id}</span>
          <span className="font-display text-sm font-semibold leading-snug drop-shadow pl-1">{book.title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function BookCover({ book, gradient, active, chapterCount, lessonCount, doneCount, onSelect }) {
  const { t } = useI18n();
  const empty = chapterCount === 0;
  const percent = lessonCount ? Math.round((doneCount / lessonCount) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative min-w-0 text-left rounded-2xl p-2 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
        active
          ? 'bg-white shadow-lg shadow-emerald-900/10 ring-2 ring-emerald-500 -translate-y-0.5'
          : 'bg-white/60 ring-1 ring-slate-200 hover:bg-white hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <CoverImage
        book={book}
        gradient={gradient}
        className={`rounded-xl shadow-md shadow-slate-900/15 ${empty ? 'grayscale opacity-60' : ''}`}
      >
        {empty && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {t.comingSoon}
          </span>
        )}
      </CoverImage>

      <div className="mt-2 px-1 pb-0.5">
        <p className="text-sm font-semibold">Book {book.id}</p>
        {empty ? (
          <p className="text-xs text-slate-400 truncate">{t.noContent}</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 truncate">{t.chaptersLessons(chapterCount, lessonCount)}</p>
            <div className="mt-1.5">
              <ProgressBar percent={percent} small />
            </div>
          </>
        )}
      </div>
    </button>
  );
}

// Accordion: chỉ mở một chapter tại một thời điểm. Mặc định mở chapter đang học dở, không có thì chapter đầu.
function BookPanel({ book, gradient, chapters, visited, lastKey }) {
  const { t } = useI18n();
  const [openChapter, setOpenChapter] = useState(undefined); // undefined = chưa chọn, null = đóng hết
  const lastChapter = lastKey?.startsWith(`${book.id}/`) ? Number(lastKey.split('/')[1]) : null;
  const defaultChapter = chapters.some((c) => c.chapter_number === lastChapter) ? lastChapter : chapters[0]?.chapter_number;
  const openNumber = openChapter === undefined ? defaultChapter : openChapter;
  const lessonCount = chapters.reduce((sum, c) => sum + c.lessons.length, 0);
  const totalMin = Math.round(chapters.reduce((sum, c) => sum + c.lessons.reduce((s, l) => s + l.duration_seconds, 0), 0) / 60);

  return (
    <section
      className="mt-6 grid md:grid-cols-[260px_1fr] rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden"
      aria-label={t.bookContentLabel(book.id)}
    >
      <aside className="flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-slate-50 to-slate-100 md:border-r border-b md:border-b-0 border-slate-200">
        <CoverImage
          book={book}
          gradient={gradient}
          className={`w-44 md:w-full rounded-xl shadow-xl shadow-slate-900/25 ring-1 ring-black/5 ${
            chapters.length === 0 ? 'grayscale opacity-60' : ''
          }`}
        />
        <div className="w-full text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Book {book.id}</p>
          <h3 className="font-display mt-1 text-xl font-semibold leading-snug">{book.title}</h3>
          {chapters.length > 0 && (
            <p className="mt-1.5 text-sm text-slate-500">{t.bookSummary(chapters.length, lessonCount, totalMin)}</p>
          )}
        </div>
      </aside>

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <LockIcon className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold">{t.comingSoonTitle}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">{t.comingSoonDesc}</p>
        </div>
      ) : (
        <div className="min-w-0 divide-y divide-slate-100">
          {chapters.map((chapter) => {
            const done = chapter.lessons.filter((l) => visited.has(lessonKey(book.id, chapter.chapter_number, l.lesson_index))).length;
            const open = chapter.chapter_number === openNumber;
            const panelId = `chapter-${book.id}-${chapter.chapter_number}`;
            return (
              <div key={chapter.chapter_number}>
                <button
                  type="button"
                  onClick={() => setOpenChapter(open ? null : chapter.chapter_number)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className={`group flex w-full items-center gap-3 px-5 sm:px-6 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
                    open ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold transition ${
                      open ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {chapter.chapter_number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base sm:text-lg font-semibold leading-snug truncate">
                      <span className="text-emerald-600">Chapter {chapter.chapter_number}</span>
                      <span className="text-slate-300 mx-2">/</span>
                      {chapter.chapter_title}
                    </span>
                    <span className="block text-xs font-medium text-slate-500 tabular-nums">
                      {t.lessonsStudied(done, chapter.lessons.length)}
                    </span>
                  </span>
                  <ChevronIcon
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180 text-emerald-600' : ''}`}
                  />
                </button>

                <div
                  id={panelId}
                  role="region"
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden" inert={!open}>
                    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 px-5 sm:px-6 pb-5 pt-1">
                      {chapter.lessons.map((lesson) => {
                        const key = lessonKey(book.id, chapter.chapter_number, lesson.lesson_index);
                        return (
                          <LessonRow
                            key={key}
                            lesson={lesson}
                            done={visited.has(key)}
                            href={lessonHref(key)}
                            onOpen={() => markOpened(key)}
                          />
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LessonRow({ lesson, done, href, onOpen }) {
  const { t } = useI18n();
  return (
    <li>
      <Link
        href={href}
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
            done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
          }`}
        >
          {done ? <CheckIcon className="h-4 w-4" /> : <PlayIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate">{lessonLabel(lesson.title)}</span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <ClockIcon className="h-3 w-3" />
            {t.minutesShort(minutes(lesson.duration_seconds))}
            {done && <span className="ml-1 text-emerald-600 font-medium">· {t.studied}</span>}
          </span>
        </span>
        <ArrowIcon className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-600 group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function ProgressBar({ percent, small = false }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-slate-200 ${small ? 'h-1' : 'h-2'}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function LibrarySkeleton() {
  const { t } = useI18n();
  return (
    <div className="mt-12 animate-pulse" aria-busy="true" aria-label={t.loading}>
      <div className="h-6 w-56 rounded bg-slate-200" />
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="aspect-[2/3.5] rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-3xl bg-slate-200" />
    </div>
  );
}

/* ---- icons ---- */
const iconProps = { viewBox: '0 0 24 24', 'aria-hidden': true };
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

function PlayIcon({ className }) {
  return (
    <svg {...iconProps} className={className} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function CheckIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke} strokeWidth={3}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
function ArrowIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
function ChevronIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ClockIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function LockIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function SearchIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function CloseIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function HeadphonesIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  );
}
