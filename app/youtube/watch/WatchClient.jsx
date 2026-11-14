'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import LessonSkeleton from '../../../components/LessonSkeleton';
import YouTubePlayer from '../../../components/YouTubePlayer';
import { downloadLesson, findLesson, uploadLesson } from '../../../lib/driveSync';
import { authHeader, ensureSession, getSession, signIn } from '../../../lib/googleAuth';
import { SEG_VERSION, extractVideoId, mergeSentences, needsCleaning, resplitSentences } from '../../../lib/youtube';
import { clearKey, getKey, isValidKeyFormat, loadLesson, loadRaw, nextResetLabel, saveLesson, saveQuota, saveRaw } from '../../../lib/ytClient';

const CLEAN_BATCH = 50;
const TRANSLATE_BATCH = 15;
const SYNC_DELAY_MS = 2500;
const MAX_AUTO_RETRIES = 3; // tự thử lại khi AI lỗi tạm thời (chờ 2s, 4s, 8s)
const TRANSIENT_CODES = ['GEMINI', 'BAD_OUTPUT', 'USAGE', 'TOO_MANY'];

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bài lưu bằng cách chia câu cũ, hoặc chưa được thêm dấu câu xong -> cần tự nâng cấp khi mở
const needsUpgrade = (lesson) => (lesson.v ?? 1) < SEG_VERSION || (lesson.clean === false && needsCleaning(lesson.sentences));

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
  const metaRef = useRef({ v: SEG_VERSION, clean: true }); // phiên bản chia câu và đã thêm dấu câu chưa
  const runId = useRef(0);
  const [sync] = useState(() => ({ timer: null }));

  // Đẩy bài lên Drive của người dùng (nếu đã đăng nhập và cấp quyền), gộp nhiều lần lưu liên tiếp thành một
  const syncNow = useCallback(() => {
    sync.timer = null;
    const session = getSession();
    if (!session?.drive || sentencesRef.current.length === 0) return;
    uploadLesson(session.token, videoId, { title: titleRef.current, sentences: sentencesRef.current, ...metaRef.current }).catch(() => {});
  }, [sync, videoId]);

  const commit = useCallback(
    (next, nextTitle = titleRef.current, meta = metaRef.current) => {
      sentencesRef.current = next;
      titleRef.current = nextTitle;
      metaRef.current = meta;
      setSentences(next);
      setTitle(nextTitle);
      saveLesson(videoId, { title: nextTitle, sentences: next, ...meta });
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
  // Lỗi tạm thời của AI thì tự thử lại vài lần trước khi báo lỗi.
  const translateMissing = useCallback(
    async (id) => {
      setTranslateFailed(false);
      setPhase('translating');
      let failures = 0;
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
          if ((!data.code || TRANSIENT_CODES.includes(data.code)) && failures < MAX_AUTO_RETRIES) {
            await sleep(2000 * 2 ** failures);
            failures++;
            continue;
          }
          setTranslateFailed(true);
          setError(data.code === 'NO_LOGIN' ? 'Phiên đăng nhập đã hết hạn. Bấm "Dịch lại" để đăng nhập Google và dịch tiếp.' : (data.message ?? 'Không dịch được. Thử lại sau.'));
          setPhase('ready');
          return;
        }
        failures = 0;
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

  // "Dịch lại": chỉ hiện khi tự thử lại vẫn lỗi. Hết phiên đăng nhập thì mở cửa sổ đăng nhập rồi dịch tiếp.
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
      metaRef.current = { v: lesson.v, clean: lesson.clean };
      setSentences(lesson.sentences);
      setTitle(titleRef.current);
      setPhase('ready');
    };

    // Thêm dấu câu bằng AI cho một danh sách dòng chữ, giữ nguyên số dòng. Lỗi ở lô nào thì giữ chữ gốc của lô đó.
    // -> { lines, ok }  (ok = false nếu có lô lỗi)
    async function cleanLines(lines) {
      const out = [...lines];
      let ok = true;
      for (let from = 0; from < lines.length; from += CLEAN_BATCH) {
        const part = lines.slice(from, from + CLEAN_BATCH);
        const res = await postJson('/api/youtube/process', { mode: 'clean', videoId, lines: part }, authHeader(getSession())).catch(() => null);
        if (id !== runId.current) return { lines: out, ok: false };
        if (res?.data?.usage) setUsage(res.data.usage);
        if (res?.ok) part.forEach((text, n) => (out[from + n] = res.data.lines[n] || text));
        else ok = false;
      }
      return { lines: out, ok };
    }

    // Nâng cấp bài đã lưu: thêm dấu câu nếu còn thiếu, rồi chia lại các câu dài. Tự làm, không cần người dùng bấm gì.
    async function upgrade(lesson) {
      let list = lesson.sentences;
      let clean = true;
      if (needsCleaning(list)) {
        setPhase('cleaning');
        const out = await cleanLines(list.map((s) => s.text));
        if (id !== runId.current) return;
        clean = out.ok;
        list = list.map((s, i) => (out.lines[i] === s.text ? s : { ...s, text: out.lines[i], vi: '' }));
      }
      commit(resplitSentences(list), lesson.title ?? videoId, { v: SEG_VERSION, clean });
    }

    // Có sẵn bài (trên máy hoặc từ Drive): hiện ngay, rồi tự nâng cấp và dịch phần còn thiếu (không tốn lượt lấy phụ đề)
    async function openLesson(lesson) {
      show(lesson);
      await ensureSession().catch(() => null); // làm mới phiên đăng nhập im lặng nếu hết hạn
      if (id !== runId.current) return;
      if (needsUpgrade(lesson)) await upgrade(lesson);
      if (id !== runId.current) return;
      if (sentencesRef.current.some((s) => !s.vi)) await translateMissing(id);
      else setPhase('ready');
    }

    // Trả về { title, segments }, hoặc null nếu đã chuyển trang / báo lỗi
    async function getTranscript() {
      const saved = loadRaw(videoId);
      if (saved) return saved;

      // Chưa có key lấy phụ đề: sang màn hình hướng dẫn tạo key
      const key = getKey();
      if (!isValidKeyFormat(key)) {
        router.replace(`/youtube/key?v=${videoId}`);
        return null;
      }

      // Kiểm tra trước còn lượt dịch hôm nay không, tránh tốn lượt lấy phụ đề rồi mới bị từ chối
      const current = await fetch('/api/youtube/usage', { headers: authHeader(getSession()) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (id !== runId.current) return null;
      if (current) {
        setUsage(current);
        if (current.used >= current.limit) {
          fail(`Hôm nay bạn đã dịch đủ ${current.limit} video. Lượt được làm mới lúc ${nextResetLabel()}.`);
          return null;
        }
      }

      const res = await postJson('/api/youtube/transcript', { url: videoId }, { 'x-transcript-key': key }).catch(() => null);
      if (id !== runId.current) return null;
      if (!res) {
        fail('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
        return null;
      }
      if (res.data.quota) saveQuota(res.data.quota);
      if (!res.ok) {
        if (res.data.code === 'BAD_KEY' || res.data.code === 'NO_KEY') {
          clearKey();
          router.replace(`/youtube/key?v=${videoId}&reason=invalid`);
          return null;
        }
        fail(res.data.message ?? 'Không lấy được phụ đề.');
        return null;
      }
      const result = { title: res.data.title ?? videoId, segments: res.data.segments };
      saveRaw(videoId, result);
      return result;
    }

    async function run() {
      // 1. Bài đã có trên máy
      const cached = loadLesson(videoId);
      if (cached) return openLesson(cached);

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
            saveLesson(videoId, data);
            return openLesson(data);
          }
        } catch {
          // Drive lỗi tạm thời: bỏ qua, tạo bài mới như bình thường
        }
      }

      // 4. Lấy phụ đề: dùng lại bản đã lấy trước đó nếu có, không thì gọi dịch vụ (tốn 1 lượt của key người dùng)
      const transcript = await getTranscript();
      if (!transcript) return;

      // 5. Phụ đề tự động thường không có dấu câu: nhờ AI thêm dấu câu, giữ nguyên mốc thời gian.
      //    AI lỗi thì vẫn tạo bài (chữ chưa có dấu câu) và tự thêm dấu câu ở lần mở sau.
      let { segments } = transcript;
      let clean = true;
      if (needsCleaning(segments)) {
        setPhase('cleaning');
        const out = await cleanLines(segments.map((s) => s.text));
        if (id !== runId.current) return;
        clean = out.ok;
        segments = segments.map((s, i) => ({ ...s, text: out.lines[i] }));
      }

      // 6. Ghép thành câu ngắn, hiện ngay bản tiếng Anh rồi dịch dần
      commit(mergeSentences(segments), transcript.title, { v: SEG_VERSION, clean });
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
    return <LessonSkeleton caption={phase === 'cleaning' ? 'Đang chỉnh dấu câu cho phụ đề...' : 'Đang lấy phụ đề của video...'} />;
  }

  const done = sentences.filter((s) => s.vi).length;
  const status =
    phase === 'cleaning'
      ? { text: 'Đang chỉnh dấu câu và chia lại câu cho ngắn gọn...' }
      : phase === 'translating'
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
