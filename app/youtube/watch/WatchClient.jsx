'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import YouTubePlayer from '../../../components/YouTubePlayer';
import { downloadLesson, findLesson, uploadLesson } from '../../../lib/driveSync';
import { authHeader, ensureSession, getSession, signIn } from '../../../lib/googleAuth';
import { extractVideoId, mergeSentences, needsCleaning } from '../../../lib/youtube';
import { clearKey, getKey, isValidKeyFormat, loadLesson, saveLesson, saveQuota } from '../../../lib/ytClient';

const CLEAN_BATCH = 50;
const TRANSLATE_BATCH = 15;
const SYNC_DELAY_MS = 2500;

export default function WatchClient() {
  const videoId = extractVideoId(useSearchParams().get('v'));
  if (!videoId) return <Message>Link video không hợp lệ.</Message>;
  // key={videoId}: đổi video thì dựng lại toàn bộ trạng thái
  return <Lesson key={videoId} videoId={videoId} />;
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function Lesson({ videoId }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading | login | cleaning | translating | ready | error
  const [error, setError] = useState('');
  const [translateFailed, setTranslateFailed] = useState(false);
  const [usage, setUsage] = useState(null);
  const [attempt, setAttempt] = useState(0); // tăng lên để chạy lại sau khi đăng nhập
  const sentencesRef = useRef([]);
  const titleRef = useRef('');
  const runId = useRef(0);
  const [sync] = useState(() => ({ timer: null }));

  // Đẩy bài lên Drive của người dùng (nếu đã đăng nhập và cấp quyền), gộp nhiều lần lưu liên tiếp thành một
  const syncNow = useCallback(() => {
    sync.timer = null;
    const session = getSession();
    if (!session?.drive || sentencesRef.current.length === 0) return;
    uploadLesson(session.token, videoId, { title: titleRef.current, sentences: sentencesRef.current }).catch(() => {});
  }, [sync, videoId]);

  const commit = useCallback(
    (next, nextTitle = titleRef.current) => {
      sentencesRef.current = next;
      titleRef.current = nextTitle;
      setSentences(next);
      setTitle(nextTitle);
      saveLesson(videoId, { title: nextTitle, sentences: next });
      clearTimeout(sync.timer);
      sync.timer = setTimeout(syncNow, SYNC_DELAY_MS);
    },
    [videoId, sync, syncNow],
  );

  // Rời trang: đẩy ngay bản mới nhất lên Drive nếu còn đang chờ
  useEffect(
    () => () => {
      if (sync.timer) {
        clearTimeout(sync.timer);
        syncNow();
      }
    },
    [sync, syncNow],
  );

  // Dịch các câu chưa có bản dịch, theo lô. Lưu sau mỗi lô nên tải lại trang vẫn giữ phần đã dịch.
  const translateMissing = useCallback(
    async (id) => {
      setTranslateFailed(false);
      setPhase('translating');
      for (;;) {
        if (id !== runId.current) return;
        const current = sentencesRef.current;
        const batch = [];
        for (let i = 0; i < current.length && batch.length < TRANSLATE_BATCH; i++) if (!current[i].vi) batch.push(i);
        if (batch.length === 0) break;
        const { ok, data } = await postJson(
          '/api/youtube/process',
          { mode: 'translate', videoId, lines: batch.map((i) => current[i].text) },
          authHeader(getSession()),
        ).catch(() => ({ ok: false, data: {} }));
        if (id !== runId.current) return;
        if (data.usage) setUsage(data.usage);
        if (!ok) {
          setTranslateFailed(true);
          setError(data.code === 'NO_LOGIN' ? 'Phiên đăng nhập đã hết hạn. Bấm "Dịch lại" để đăng nhập Google và dịch tiếp.' : (data.message ?? 'Không dịch được. Thử lại sau.'));
          setPhase('ready');
          return;
        }
        const next = sentencesRef.current.map((s) => ({ ...s }));
        batch.forEach((i, n) => {
          next[i].vi = data.lines[n] || '—';
        });
        commit(next);
      }
      setPhase('ready');
    },
    [commit, videoId],
  );

  // "Dịch lại": nếu hết phiên đăng nhập thì mở cửa sổ đăng nhập (đang trong sự kiện bấm nút) rồi dịch tiếp
  const retryTranslate = useCallback(async () => {
    const session = getSession() ?? (await signIn().catch(() => null));
    if (session) translateMissing(runId.current);
  }, [translateMissing]);

  useEffect(() => {
    const id = ++runId.current;

    const fail = (message) => {
      setError(message);
      setPhase('error');
    };

    const show = (lesson) => {
      sentencesRef.current = lesson.sentences;
      titleRef.current = lesson.title ?? videoId;
      setSentences(lesson.sentences);
      setTitle(titleRef.current);
      setPhase('ready');
    };

    async function run() {
      // 1. Bài đã có trên máy: hiện ngay, chỉ dịch lại những câu đang thiếu bản dịch (không tốn lượt lấy phụ đề)
      const cached = loadLesson(videoId);
      if (cached) {
        show(cached);
        if (cached.sentences.some((s) => !s.vi)) await translateMissing(id);
        return;
      }

      // 2. Cần đăng nhập Google (để giới hạn lượt dịch theo người và đồng bộ Drive)
      const session = await ensureSession();
      if (id !== runId.current) return;
      if (!session) return setPhase('login');

      // 3. Bài đã tạo ở thiết bị khác: lấy từ Drive của người dùng, không tốn lượt nào
      if (session.drive) {
        try {
          const hit = await findLesson(session.token, videoId);
          const data = hit && (await downloadLesson(session.token, hit.fileId));
          if (id !== runId.current) return;
          if (Array.isArray(data?.sentences) && data.sentences.length > 0) {
            saveLesson(videoId, { title: data.title, sentences: data.sentences });
            show(data);
            if (data.sentences.some((s) => !s.vi)) await translateMissing(id);
            return;
          }
        } catch {
          // Drive lỗi tạm thời: bỏ qua, tạo bài mới như bình thường
        }
      }

      // 4. Chưa có key lấy phụ đề: sang màn hình hướng dẫn tạo key
      const key = getKey();
      if (!isValidKeyFormat(key)) {
        router.replace(`/youtube/key?v=${videoId}`);
        return;
      }

      // 5. Kiểm tra trước còn lượt dịch hôm nay không, tránh tốn lượt lấy phụ đề rồi mới bị từ chối
      const current = await fetch('/api/youtube/usage', { headers: authHeader(session) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (id !== runId.current) return;
      if (current) {
        setUsage(current);
        if (current.used >= current.limit) return fail(`Hôm nay bạn đã dịch đủ ${current.limit} video. Lượt làm mới lúc 00:00 UTC.`);
      }

      // 6. Lấy phụ đề (tốn 1 lượt của key người dùng)
      const res = await postJson('/api/youtube/transcript', { url: videoId }, { 'x-transcript-key': key }).catch(() => null);
      if (id !== runId.current) return;
      if (!res) return fail('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      if (res.data.quota) saveQuota(res.data.quota);
      if (!res.ok) {
        if (res.data.code === 'BAD_KEY' || res.data.code === 'NO_KEY') {
          clearKey();
          router.replace(`/youtube/key?v=${videoId}&reason=invalid`);
          return;
        }
        return fail(res.data.message ?? 'Không lấy được phụ đề.');
      }

      let segments = res.data.segments;
      const videoTitle = res.data.title ?? videoId;

      // 7. Phụ đề tự động thường không có dấu câu: nhờ AI thêm dấu câu, giữ nguyên mốc thời gian
      if (needsCleaning(segments)) {
        setPhase('cleaning');
        const cleaned = segments.map((s) => ({ ...s }));
        for (let from = 0; from < cleaned.length; from += CLEAN_BATCH) {
          const part = cleaned.slice(from, from + CLEAN_BATCH);
          const out = await postJson(
            '/api/youtube/process',
            { mode: 'clean', videoId, lines: part.map((s) => s.text) },
            authHeader(getSession()),
          ).catch(() => null);
          if (id !== runId.current) return;
          if (out?.data?.usage) setUsage(out.data.usage);
          if (out?.ok) part.forEach((s, n) => (s.text = out.data.lines[n] || s.text));
          else if (out?.data?.code === 'NO_LOGIN') return setPhase('login');
          else if (out?.data?.code === 'NO_GEMINI' || out?.data?.code === 'DAILY_LIMIT') return fail(out.data.message);
          // Lỗi AI ở một lô: giữ nguyên chữ gốc của lô đó, các câu sẽ được ghép theo độ dài
        }
        segments = cleaned;
      }

      // 8. Ghép thành câu, hiện ngay bản tiếng Anh rồi dịch dần
      commit(mergeSentences(segments), videoTitle);
      await translateMissing(id);
    }

    run();
    return () => {
      runId.current = id + 1; // hủy lượt chạy đang dở khi rời trang
    };
  }, [videoId, router, commit, translateMissing, attempt]);

  if (phase === 'login') {
    return (
      <Message>
        <span className="block text-slate-700">Đăng nhập Google để tạo bài học. Mỗi người được dịch tối đa 10 video mỗi ngày và bài được lưu vào Drive của chính bạn.</span>
        <button
          type="button"
          onClick={() => signIn().then((s) => s && setAttempt((n) => n + 1)).catch((e) => { setError(e.message); setPhase('error'); })}
          className="mt-4 h-11 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white hover:bg-emerald-600 transition"
        >
          Đăng nhập Google
        </button>
        <Link href="/youtube" className="mt-3 block text-emerald-700 underline">
          Quay lại
        </Link>
      </Message>
    );
  }
  if (phase === 'error') {
    return (
      <Message>
        <span role="alert" className="block text-red-700">
          {error}
        </span>
        <Link href="/youtube" className="mt-3 inline-block text-emerald-700 underline">
          Quay lại
        </Link>
      </Message>
    );
  }
  if (sentences.length === 0) {
    return <Message>{phase === 'cleaning' ? 'Đang chỉnh dấu câu cho phụ đề...' : 'Đang chuẩn bị bài học...'}</Message>;
  }

  const done = sentences.filter((s) => s.vi).length;
  const status =
    phase === 'translating'
      ? { text: `Đang dịch ${done}/${sentences.length} câu...` }
      : translateFailed
        ? { text: `${error} (đã dịch ${done}/${sentences.length} câu)`, retry: true }
        : null;

  return <YouTubePlayer videoId={videoId} title={title} sentences={sentences} status={status} usage={usage} onRetryTranslate={retryTranslate} />;
}

function Message({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-center text-sm text-slate-500">
      <div className="max-w-md">{children}</div>
    </div>
  );
}
