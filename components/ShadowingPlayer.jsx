'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonLabel, useI18n } from '../lib/i18n';
import { formatTime, getSentences } from '../lib/sentences';
import LanguageSwitch from './LanguageSwitch';

const SPEEDS = [0.75, 0.9, 1, 1.25];

function findActive(sentences, t) {
  let idx = 0;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].start <= t + 0.05) idx = i;
    else break;
  }
  return idx;
}

export default function ShadowingPlayer({ bookId, coverUrl, bookLabel, chapter, heading, lesson, prevHref, nextHref }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const sentences = useMemo(() => getSentences(lesson), [lesson]);
  const hasTimestamps = Array.isArray(lesson.segments) && lesson.segments.length > 0;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(lesson.duration_seconds);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [showText, setShowText] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const hasTranslation = sentences.some((s) => s.vi);
  const [speed, setSpeed] = useState(1);
  const [hasCover, setHasCover] = useState(Boolean(bookId || coverUrl));
  const coverSrc = coverUrl ?? `/covers/book_${bookId}.jpg`;

  const activeIndex = findActive(sentences, time);
  const active = sentences[activeIndex];

  const play = useCallback(() => audioRef.current?.play().catch(() => {}), []);

  const seekTo = useCallback(
    (index, autoplay = true) => {
      const audio = audioRef.current;
      const target = sentences[Math.min(Math.max(index, 0), sentences.length - 1)];
      if (!audio || !target) return;
      audio.currentTime = target.start;
      setTime(target.start);
      if (autoplay) play();
    },
    [sentences, play],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  // Cập nhật thời gian ~60fps khi đang phát để lặp câu chính xác (timeupdate chỉ ~4Hz)
  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        if (loop) {
          const current = sentences[findActive(sentences, audio.currentTime)];
          if (current && audio.currentTime >= current.end - 0.03) audio.currentTime = current.start;
        }
        setTime(Math.round(audio.currentTime * 10) / 10);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, sentences]);

  // Cuộn danh sách phụ đề tới câu đang đọc (chỉ cuộn trong khung, không cuộn cả trang)
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector(`[data-idx="${activeIndex}"]`);
    if (!list || !el) return;
    list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [activeIndex]);

  // Phím tắt: Space = phát/dừng, ←/→ = câu trước/sau
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') seekTo(activeIndex - 1);
      else if (e.code === 'ArrowRight') seekTo(activeIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekTo, activeIndex]);

  const changeSpeed = (value) => {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  const blur = showText ? '' : 'blur-sm select-none';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" aria-label={t.home} title={t.home} className="p-2 -ml-2 rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold truncate">
              {heading ?? `Chapter ${chapter.chapter_number}: ${chapter.chapter_title} · ${lessonLabel(lesson.title)}`}
            </h1>
            <p className="text-xs text-slate-500 truncate">{bookLabel}</p>
          </div>
          <LessonLink href={prevHref}>{t.prevLessonLink}</LessonLink>
          <LessonLink href={nextHref}>{t.nextLessonLink}</LessonLink>
          <LanguageSwitch tone="light" />
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_680px]">
        <section className="min-w-0 space-y-4">
          {/* Khu vực "video" -> audio */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 aspect-video max-h-[60vh] w-full">
            {hasCover ? (
              <>
                {/* Ảnh bìa cao bằng khung, giữ nguyên tỉ lệ (không cắt); hai bên là nền mờ từ chính ảnh */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverSrc}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverSrc}
                  alt={bookLabel}
                  onError={() => setHasCover(false)}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <PlayToggle playing={playing} onClick={togglePlay} t={t} overCover />
              </>
            ) : (
              <>
                {/* Nền tĩnh: gradient êm + vài vầng sáng mờ, không chuyển động để dễ tập trung */}
                <div
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{
                    background:
                      'radial-gradient(60% 70% at 20% 15%, rgba(52,211,153,.22), transparent 60%), radial-gradient(50% 60% at 85% 90%, rgba(99,102,241,.22), transparent 60%)',
                  }}
                />
                <svg
                  viewBox="0 0 24 24"
                  className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-white/[0.06]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                  <rect x="3" y="14" width="4" height="6" rx="1.5" />
                  <rect x="17" y="14" width="4" height="6" rx="1.5" />
                </svg>
                <PlayToggle playing={playing} onClick={togglePlay} t={t} />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-xs text-white">
              <span className="tabular-nums w-10">{formatTime(time)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                aria-label={t.seek}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  if (audioRef.current) audioRef.current.currentTime = t;
                  setTime(t);
                }}
                className="flex-1 accent-emerald-400"
              />
              <span className="tabular-nums w-10 text-right">{formatTime(duration)}</span>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={lesson.audio_url}
            preload="auto"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />

          {/* Câu đang đọc */}
          <div className="rounded-2xl bg-white border border-slate-200 px-5 py-5 text-center min-h-24 flex flex-col items-center justify-center gap-3">
            {active?.speaker && (
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{active.speaker}</p>
            )}
            <p className={`text-lg sm:text-xl font-semibold leading-snug transition ${blur}`}>{active?.text}</p>
            {hasTranslation && showVi && active?.vi && (
              <p className="text-base sm:text-lg font-medium text-emerald-700 leading-snug">{active.vi}</p>
            )}
          </div>

          {/* Điều khiển */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ControlButton onClick={() => seekTo(activeIndex - 1)} label={t.prevSentence}>
              <SkipIcon flip />
            </ControlButton>
            <ControlButton onClick={() => seekTo(activeIndex)} label={t.replaySentence}>
              <ReplayIcon />
            </ControlButton>
            <ControlButton onClick={togglePlay} label={playing ? t.pauseKey : t.playKey} primary>
              {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
            </ControlButton>
            <ControlButton onClick={() => seekTo(activeIndex + 1)} label={t.nextSentence}>
              <SkipIcon />
            </ControlButton>
            <ControlButton onClick={() => setLoop((v) => !v)} label={t.loopLabel} active={loop}>
              <span className="text-sm font-medium">{t.loopShort}</span>
            </ControlButton>
            <ControlButton onClick={() => setShowText((v) => !v)} label={t.toggleSubs} active={!showText}>
              <span className="text-sm font-medium">{showText ? t.hideSubs : t.showSubs}</span>
            </ControlButton>
            {hasTranslation && (
              <ControlButton onClick={() => setShowVi((v) => !v)} label={showVi ? t.hideTranslation : t.showTranslation} active={!showVi}>
                <span className="text-sm font-medium">{showVi ? t.hideTranslation : t.showTranslation}</span>
              </ControlButton>
            )}
            <label className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 h-10 text-sm">
              {t.speed}
              <select
                value={speed}
                onChange={(e) => changeSpeed(Number(e.target.value))}
                className="bg-transparent font-medium focus:outline-none"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Phụ đề */}
        <aside className="rounded-2xl bg-white border border-slate-200 flex flex-col overflow-hidden max-h-[28rem] lg:max-h-none lg:h-[calc(100vh-6.5rem)] lg:sticky lg:top-[4.5rem]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold">{t.subtitles}</h2>
            <span className="text-xs text-slate-500">{t.sentenceCount(sentences.length)}</span>
          </div>
          {!hasTimestamps && (
            <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
              {t.noTimestamps}
            </p>
          )}
          <ol ref={listRef} className="relative flex-1 overflow-y-auto p-2 space-y-1">
            {sentences.map((s, i) => (
              <li key={i} data-idx={i}>
                <button
                  onClick={() => seekTo(i)}
                  className={`group w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                    i === activeIndex ? 'bg-emerald-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      i === activeIndex ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <PlayIcon size={10} />
                  </span>
                  <span className="min-w-0">
                    {s.speaker && <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.speaker}</span>}
                    <span className={`block text-base leading-relaxed ${blur} ${showText ? '' : 'group-hover:blur-none'}`}>
                      {s.text}
                    </span>
                    {showVi && s.vi && (
                      <span className="block text-[15px] leading-relaxed text-slate-600 mt-0.5">{s.vi}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}

// Nút phát/dừng ở giữa khung. Khi đè lên ảnh bìa và đang phát thì mờ đi để không che ảnh, rê chuột/focus để hiện lại.
function PlayToggle({ playing, onClick, t, overCover = false }) {
  const fade = overCover && playing ? 'opacity-0 hover:opacity-100 focus-visible:opacity-100' : 'opacity-100';
  return (
    <button
      onClick={onClick}
      aria-label={playing ? t.pause : t.play}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xl hover:scale-105 transition ${fade}`}
    >
      {playing ? <PauseIcon size={34} /> : <PlayIcon size={34} />}
    </button>
  );
}

function LessonLink({ href, children }) {
  const base = 'hidden sm:inline-flex items-center rounded-full px-4 h-9 text-sm font-medium border';
  if (!href) return <span className={`${base} border-slate-100 text-slate-300`}>{children}</span>;
  return (
    <Link href={href} className={`${base} border-slate-200 hover:bg-slate-50`}>
      {children}
    </Link>
  );
}

function ControlButton({ children, onClick, label, primary, active }) {
  const style = primary
    ? 'bg-emerald-500 text-white hover:bg-emerald-600 w-12'
    : active
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 px-4'
      : 'bg-white border border-slate-200 hover:bg-slate-50 px-4';
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-10 items-center justify-center rounded-full transition ${style}`}
    >
      {children}
    </button>
  );
}

function PlayIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

function SkipIcon({ flip }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      <path d="M6 5v14l9-7zm10 0h2v14h-2z" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
    </svg>
  );
}
