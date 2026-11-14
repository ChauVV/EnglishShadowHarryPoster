'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/sentences';
import { useQuota, nextResetLabel } from '../lib/ytClient';
import LanguageSwitch from './LanguageSwitch';
import { ControlButton, PauseIcon, PlayIcon, ReplayIcon, SkipIcon } from './ShadowingPlayer';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function findActive(sentences, t) {
  let idx = 0;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].start <= t + 0.05) idx = i;
    else break;
  }
  return idx;
}

// Nạp YouTube IFrame API một lần cho cả trang
let apiPromise;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return new Promise(() => {});
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

// Video YouTube nhúng (không tải video về) + danh sách câu có mốc thời gian, bản dịch, lặp câu, đổi tốc độ.
export default function YouTubePlayer({ videoId, title, sentences, status, usage, onRetryTranslate }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const listRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [loopSentence, setLoopSentence] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showText, setShowText] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const quota = useQuota();

  const activeIndex = findActive(sentences, time);
  const active = sentences[activeIndex];
  const hasTranslation = sentences.some((s) => s.vi);

  // Tạo player của YouTube
  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    let player;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !host) return;
      const el = document.createElement('div');
      host.appendChild(el);
      player = new YT.Player(el, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            setReady(true);
          },
          onStateChange: (e) => setPlaying(e.data === 1),
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // player chưa kịp tạo xong
      }
      if (host) host.innerHTML = '';
    };
  }, [videoId]);

  useEffect(() => {
    if (ready) playerRef.current?.setPlaybackRate(speed);
  }, [ready, speed]);

  const seekTo = useCallback(
    (index, autoplay = true) => {
      const player = playerRef.current;
      const target = sentences[Math.min(Math.max(index, 0), sentences.length - 1)];
      if (!player || !target) return;
      player.seekTo(target.start, true);
      setTime(target.start);
      setLoopIndex(sentences.indexOf(target));
      if (autoplay) player.playVideo();
    },
    [sentences],
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.getPlayerState() === 1) player.pauseVideo();
    else player.playVideo();
  }, []);

  // Theo dõi thời gian ~60fps khi đang phát để tô sáng câu và lặp câu chính xác
  useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      const player = playerRef.current;
      if (player?.getCurrentTime) {
        const now = player.getCurrentTime();
        const target = sentences[loopIndex];
        if (loopSentence && target && (now >= target.end - 0.05 || now < target.start - 0.5)) {
          player.seekTo(target.start, true);
        } else {
          setTime(Math.round(now * 10) / 10);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loopSentence, loopIndex, sentences]);

  // Cuộn danh sách tới câu đang đọc (chỉ trong khung)
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

  const toggleLoop = () => {
    setLoopIndex(activeIndex);
    setLoopSentence((v) => !v);
  };

  const blur = showText ? '' : 'blur-sm select-none';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/youtube" aria-label="Quay lại" title="Quay lại" className="p-2 -ml-2 rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm lg:text-base font-bold truncate">{title}</h1>
            <p className="text-[11px] lg:text-xs text-slate-500 truncate">
              {usage ? `Đã dịch ${usage.used}/${usage.limit} video · ` : ''}Lấy phụ đề {quota.used}/{quota.limit} lượt · làm mới lúc {nextResetLabel()}
            </p>
          </div>
          <LanguageSwitch tone="light" />
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_680px]">
        <section className="min-w-0 space-y-4">
          <div
            ref={hostRef}
            className="relative mx-auto aspect-video max-h-[60vh] max-w-[calc(60vh*16/9)] w-full overflow-hidden rounded-2xl bg-slate-900 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full"
          />

          <div className="mx-auto w-full max-w-[calc(60vh*16/9)] rounded-2xl bg-white border border-slate-200 px-4 py-3 lg:px-5 lg:py-4 text-center min-h-16 lg:min-h-24 flex flex-col items-center justify-center gap-1 lg:gap-2">
            <p className={`text-[13px] lg:text-lg font-semibold leading-snug transition ${blur}`}>{active?.text}</p>
            {hasTranslation && showVi && active?.vi && (
              <p className="text-[11px] lg:text-base font-medium text-emerald-700 leading-snug">{active.vi}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 lg:gap-2">
            <ControlButton onClick={() => seekTo(activeIndex - 1)} label="Câu trước (←)">
              <SkipIcon flip />
            </ControlButton>
            <ControlButton onClick={toggleLoop} label="Lặp lại câu này" active={loopSentence}>
              <ReplayIcon />
            </ControlButton>
            <ControlButton onClick={togglePlay} label="Phát/dừng (Space)" primary>
              {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
            </ControlButton>
            <ControlButton onClick={() => seekTo(activeIndex + 1)} label="Câu sau (→)">
              <SkipIcon />
            </ControlButton>
            <ControlButton onClick={() => setShowText((v) => !v)} label="Ẩn/hiện phụ đề" active={!showText}>
              <span className="text-xs lg:text-sm font-medium">{showText ? 'Ẩn phụ đề' : 'Hiện phụ đề'}</span>
            </ControlButton>
            {hasTranslation && (
              <ControlButton onClick={() => setShowVi((v) => !v)} label="Ẩn/hiện bản dịch" active={!showVi}>
                <span className="text-xs lg:text-sm font-medium">{showVi ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</span>
              </ControlButton>
            )}
            <label className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 h-8 lg:h-10 text-xs lg:text-sm">
              Tốc độ
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-transparent font-medium focus:outline-none">
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <aside className="rounded-2xl bg-white border border-slate-200 flex flex-col overflow-hidden h-[calc(100dvh-5rem)] scroll-mt-[4.5rem] lg:h-[calc(100vh-6.5rem)] lg:sticky lg:top-[4.5rem]">
          <div className="flex items-center justify-between px-4 py-2 lg:py-3 border-b border-slate-100">
            <h2 className="text-sm lg:text-base font-semibold">Phụ đề</h2>
            <span className="text-xs text-slate-500">{sentences.length} câu</span>
          </div>
          {status && (
            <p className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-100">
              <span>{status.text}</span>
              {status.retry && (
                <button type="button" onClick={onRetryTranslate} className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700">
                  Dịch lại
                </button>
              )}
            </p>
          )}
          <ol ref={listRef} className="relative flex-1 overflow-y-auto p-2 space-y-1">
            {sentences.map((s, i) => (
              <li key={i} data-idx={i}>
                <button
                  onClick={() => seekTo(i)}
                  className={`group w-full flex items-start gap-2.5 lg:gap-3 rounded-xl px-2.5 py-2 lg:px-3 lg:py-3 text-left transition ${
                    i === activeIndex ? 'bg-emerald-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i === activeIndex ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <PlayIcon size={10} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] tabular-nums text-slate-400">{formatTime(s.start)}</span>
                    <span className={`block text-[13px] lg:text-base leading-relaxed ${blur} ${showText ? '' : 'group-hover:blur-none'}`}>{s.text}</span>
                    {showVi && s.vi && <span className="block text-xs lg:text-[15px] leading-relaxed text-slate-600 mt-0.5">{s.vi}</span>}
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
