'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeleteLessonButton from '../components/DeleteLessonButton';
import NoticeDialog from '../components/NoticeDialog';
import SiteHeader from '../components/SiteHeader';
import { FaYoutube } from 'react-icons/fa';
import TopicIcon from '../components/TopicIcon';
import { FEATURED_VIDEOS } from '../lib/featuredVideos';
import { lessonLabel, useI18n } from '../lib/i18n';
import { formatTime } from '../lib/sentences';
import { topicCoverSrc } from '../lib/topicCovers';
import { markTopicLessonOpened, topicLessonKey } from '../lib/topicProgress';
import { useGenerateLesson } from '../lib/useGenerateLesson';
import { useYouTubeLessons } from '../lib/useYouTubeLessons';
import { errorMessage, useFlash } from '../lib/ytFlash';


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
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  // Lỗi khi tạo bài học từ trang xem video (hết lượt, lỗi mạng...): trang đó đưa về đây kèm popup cảnh báo, chỉ hiện một lần
  const [notice, closeNotice] = useFlash();

  useEffect(() => {
    fetch('/api/topics')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setTopics(data.topics))
      .catch(() => {
        setError(true);
        setTopics([]);
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar query={query} onQueryChange={setQuery} />

      <Hero />

      <main className="flex-1 px-4 pb-10 sm:px-6">
        {error && (
          <p className="mt-8 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {t.loadError}
          </p>
        )}

        {!topics && <LibrarySkeleton />}

        {topics?.length > 0 && <TopicsSection topics={topics} query={query} onClearQuery={() => setQuery('')} />}

        {topics && !error && topics.length === 0 && <FreeTopicsPlaceholder />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="px-4 py-6 text-xs text-slate-500 sm:px-6">
          <p>{t.footer}</p>
          <p className="mt-1">
            {t.photoCredit}{' '}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-slate-700">
              Pexels
            </a>
          </p>
        </div>
      </footer>

      {notice && <NoticeDialog title={t.yt.noticeTitle} message={errorMessage(t.yt, notice)} okLabel={t.yt.noticeOk} onClose={closeNotice} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */


function TopBar({ query, onQueryChange }) {
  const { t } = useI18n();
  return (
    <SiteHeader>
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
    </SiteHeader>
  );
}

// Banner đầu trang (gọn): một khối nền xanh, một tab YouTube và ô nhập link. Bấm Generate thì chuyển sang trang tạo bài.
function Hero() {
  const { t } = useI18n();
  const { url, setUrl, error, busy, generate } = useGenerateLesson();
  return (
    <section className="px-4 pt-3 sm:px-6">
      <div className="rounded-xl bg-gradient-to-br from-emerald-700 via-emerald-500 to-teal-300 px-3 pb-3 pt-2.5 text-white shadow-sm sm:px-4">
        <h1 className="font-display text-base font-bold leading-tight tracking-tight sm:text-lg">{t.heroTitle}</h1>

        <div className="mt-2">
          <div className="flex w-fit items-center gap-1.5 rounded-t-lg bg-white px-3 py-1 text-xs font-semibold text-[#FF0000]">
            <FaYoutube className="h-4 w-4" aria-hidden="true" />
            YouTube
          </div>
          <form onSubmit={generate} className="rounded-b-lg rounded-tr-lg bg-white p-2.5 text-slate-900">
            <label htmlFor="home-yt-url" className="sr-only">
              {t.linkLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="home-yt-url"
                type="text"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.linkPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-[13px] focus:border-emerald-500 focus:outline-2 focus:outline-emerald-400/30"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-emerald-500 px-6 text-[13px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                {t.generate}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-1.5 text-xs text-red-600">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}


// Topic miễn phí: hàng tag chủ đề (bấm để cuộn tới hàng của topic) + mỗi topic là một nhóm có tiêu đề, bên dưới là hàng lesson cuộn ngang (kiểu Corodomo)
function TopicsSection({ topics, query, onClearQuery }) {
  const { t } = useI18n();
  const sectionRef = useRef(null);
  const barRef = useRef(null); // thanh tag: xuống dòng khi dài nên chiều cao thay đổi
  const [tag, setTag] = useState(null); // slug topic đang hiển thị trên màn hình (để tô tag), null = đầu danh sách

  // Video YouTube của người dùng: hàng riêng ở đầu danh sách (mới nhất bên trái), lọc theo ô tìm kiếm
  const youtubeAll = useYouTubeLessons();
  const youtube = useMemo(() => {
    const q = normalizeText(query);
    if (!q || 'youtube'.includes(q)) return youtubeAll;
    return youtubeAll.filter((l) => normalizeText(l.title).includes(q));
  }, [youtubeAll, query]);
  // Video gợi ý (chưa có trong danh sách của người dùng), cũng lọc theo ô tìm kiếm
  const suggested = useMemo(() => {
    const own = new Set(youtubeAll.map((l) => l.id));
    const q = normalizeText(query);
    return FEATURED_VIDEOS.filter((v) => !own.has(v.id) && (!q || 'youtube'.includes(q) || normalizeText(`${v.title} ${v.channel}`).includes(q)));
  }, [youtubeAll, query]);
  const hasYoutube = youtube.length > 0 || suggested.length > 0;

  const visible = useMemo(() => {
    const q = normalizeText(query);
    const result = [];
    for (const topic of topics) {
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
  }, [topics, query]);

  // Khoảng cần chừa phía trên khi cuộn tới một hàng: header, cộng thanh tag nếu nó đang dính (chỉ ở màn hình rộng)
  const stickyOffset = useCallback(() => HEADER_HEIGHT + (window.matchMedia('(min-width: 1024px)').matches ? (barRef.current?.offsetHeight ?? 0) : 0), []);

  // Tô tag theo hàng topic đang nằm ngay dưới thanh tag khi cuộn trang
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = null;
      const slugs = [...(hasYoutube ? ['youtube'] : []), ...visible.map(({ topic }) => topic.topic)];
      for (const slug of slugs) {
        const el = document.getElementById(`topic-${slug}`);
        if (el && el.getBoundingClientRect().top <= stickyOffset() + 8) current = slug;
      }
      setTag(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [visible, hasYoutube, stickyOffset]);

  const scrollToTopic = (slug) => {
    const el = slug ? document.getElementById(`topic-${slug}`) : sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} className="mt-4" aria-label={t.topicsTitle}>
      <TopicTags topics={visible.map((v) => v.topic)} youtube={hasYoutube} tag={tag} onSelect={scrollToTopic} barRef={barRef} />

      <div className="mt-4" />

      {visible.length === 0 && !hasYoutube ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold">{t.noResults}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{t.noResultsDesc}</p>
          <button
            type="button"
            onClick={onClearQuery}
            className="mt-4 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            {t.clearFilters}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {hasYoutube && <YouTubeRow lessons={youtube} suggested={suggested} />}
          {visible.map(({ topic, lessons }) => (
            <TopicRow key={topic.topic} topic={topic} lessons={lessons} gradient={COVERS[(topic.number - 1) % COVERS.length]} />
          ))}
        </div>
      )}
    </section>
  );
}

// Hàng video YouTube nằm đầu danh sách: video của người dùng (mới nhất bên trái), sau đó là các video gợi ý
function YouTubeRow({ lessons, suggested }) {
  const { t } = useI18n();
  const scroller = useRef(null);
  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div id="topic-youtube" className="scroll-mt-28">
      <div className="mb-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display flex items-center gap-2 text-lg sm:text-xl font-semibold leading-tight">
            <FaYoutube className="h-6 w-6 shrink-0 text-[#FF0000]" aria-hidden="true" />
            YouTube
          </h3>
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
        {lessons.map((lesson) => (
          <li key={lesson.id} className="group/card relative w-44 sm:w-52 shrink-0 snap-start">
            <Link href={`/youtube/watch?v=${lesson.id}`} className="group block rounded-xl focus-visible:outline-none">
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-slate-200 shadow-sm transition group-hover:shadow-md group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${lesson.id}/mqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition group-hover:opacity-100">
                  <PlayIcon className="h-8 w-8" />
                </span>
                {lesson.count > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
                    {t.youtubeSentences(lesson.count)}
                  </span>
                )}
              </span>
              <span className="mt-1.5 block text-[13px] font-semibold leading-snug line-clamp-2 group-hover:text-emerald-700">{lesson.title}</span>
            </Link>
            <DeleteLessonButton
              id={lesson.id}
              title={lesson.title}
              className="absolute right-1.5 top-1.5 bg-black/60 text-white hover:bg-red-600 sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:opacity-100"
            />
          </li>
        ))}
        {suggested.map((video) => (
          <li key={video.id} className="w-44 sm:w-52 shrink-0 snap-start">
            <Link href={`/youtube/watch?v=${video.id}`} title={`${video.channel}. ${video.ready ? t.youtubeReadyHint : t.youtubeCostHint}`} className="group block rounded-xl focus-visible:outline-none">
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-slate-200 shadow-sm transition group-hover:shadow-md group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition group-hover:opacity-100">
                  <PlayIcon className="h-8 w-8" />
                </span>
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
                  <ClockIcon className="h-3 w-3" />
                  {formatTime(video.seconds)}
                </span>
              </span>
              <span className="mt-1.5 block text-[13px] font-semibold leading-snug line-clamp-2 group-hover:text-emerald-700">{video.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Màu tag: nền pastel + viền nhạt + chữ/icon cùng tông đậm; tag đang chọn đổi sang nền đặc, chữ trắng
const TAG_COLORS = [
  { idle: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100', active: 'border-emerald-600 bg-emerald-600' },
  { idle: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100', active: 'border-sky-600 bg-sky-600' },
  { idle: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100', active: 'border-violet-600 bg-violet-600' },
  { idle: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100', active: 'border-amber-600 bg-amber-600' },
  { idle: 'border-lime-300 bg-lime-50 text-lime-800 hover:bg-lime-100', active: 'border-lime-700 bg-lime-700' },
  { idle: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100', active: 'border-teal-600 bg-teal-600' },
  { idle: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100', active: 'border-indigo-600 bg-indigo-600' },
  { idle: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100', active: 'border-orange-600 bg-orange-600' },
  { idle: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100', active: 'border-pink-600 bg-pink-600' },
  { idle: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100', active: 'border-cyan-600 bg-cyan-600' },
];
// Topic 15 (Money & Banking) trùng màu lime với topic 05 (Daily Routines) nên cho màu vàng riêng
const TAG_COLOR_OVERRIDE = {
  15: { idle: 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100', active: 'border-yellow-500 bg-yellow-500' },
};
// Màu của topic (theo số thứ tự) dùng chung cho tag và tiêu đề hàng topic
const topicColor = (number) => TAG_COLOR_OVERRIDE[number] ?? TAG_COLORS[(number - 1) % TAG_COLORS.length];
// Màu chữ của tiêu đề topic = màu chữ của tag (lấy từ chính chuỗi lớp của tag nên luôn khớp)
const topicTitleClass = (number) => topicColor(number).idle.match(/text-[a-z]+-[0-9]+/)?.[0] ?? 'text-slate-900';
const TAG_ALL_COLOR = { idle: 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200', active: 'border-slate-700 bg-slate-700' };
const TAG_YOUTUBE_COLOR = { idle: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100', active: 'border-red-600 bg-red-600' };

// Chiều cao header cố định (h-14)
const HEADER_HEIGHT = 56;

// Các tag chủ đề: dài thì xuống dòng. Chỉ dính dưới header ở màn hình rộng (trên điện thoại nhiều dòng sẽ chiếm quá nhiều chỗ).
function TopicTags({ topics, youtube, tag, onSelect, barRef }) {
  const { t } = useI18n();
  const items = [
    { slug: null, label: t.allTopics, icon: 'all', color: TAG_ALL_COLOR },
    ...(youtube ? [{ slug: 'youtube', label: 'YouTube', icon: 'youtube', color: TAG_YOUTUBE_COLOR }] : []),
    ...topics.map((tp) => ({
      slug: tp.topic,
      label: tp.title,
      icon: tp.number,
      color: topicColor(tp.number),
    })),
  ];
  return (
    <div ref={barRef} className="lg:sticky lg:top-14 z-20 -mx-4 border-b border-slate-200/70 bg-slate-50/90 px-4 py-2.5 sm:-mx-6 sm:px-6 backdrop-blur">
      <ul
        role="group"
        aria-label={t.topicTags}
        className="flex flex-wrap gap-2"
      >
        {items.map((item) => {
          const active = item.slug === tag;
          return (
            <li key={item.slug ?? 'all'}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item.slug)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500 ${
                  active ? `${item.color.active} font-semibold text-white shadow-sm` : item.color.idle
                }`}
              >
                {item.icon === 'youtube' ? (
                  <FaYoutube className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <TopicIcon number={item.icon} className="h-3.5 w-3.5 shrink-0" />
                )}
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
  const scroller = useRef(null);
  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div id={`topic-${topic.topic}`} className="scroll-mt-28">
      <div className="mb-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-lg sm:text-xl font-semibold leading-tight truncate ${topicTitleClass(topic.number)}`}>{topic.title}</h3>
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
              href={`/topic/${encodeURIComponent(topic.topic)}/${lesson.lesson_index}`}
              onOpen={() => markTopicLessonOpened(key)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function LessonCard({ lesson, gradient, coverSrc, href, onOpen }) {
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

// Chưa có chủ đề nào để hiển thị
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

function LibrarySkeleton() {
  const { t } = useI18n();
  return (
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label={t.loading}>
      <div className="h-7 w-2/3 rounded-full bg-slate-200" />
      <div className="mt-6 h-6 w-48 rounded bg-slate-200" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-video w-44 sm:w-52 shrink-0 rounded-xl bg-slate-200" />
        ))}
      </div>
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
function ArrowIcon({ className }) {
  return (
    <svg {...iconProps} className={className} {...stroke}>
      <path d="M5 12h14m-6-6 6 6-6 6" />
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
