'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import LessonSkeleton from '../../../components/LessonSkeleton';
import YouTubePlayer from '../../../components/YouTubePlayer';
import { downloadLesson, findLesson, uploadLesson } from '../../../lib/driveSync';
import { authHeader, ensureSession, getSession, signIn } from '../../../lib/googleAuth';
import { SEG_VERSION, extractVideoId, mergeSentences, resplitSentences } from '../../../lib/youtube';
import { clearKey, getKey, isValidKeyFormat, loadLesson, loadRaw, nextResetLabel, saveLesson, saveQuota, saveRaw } from '../../../lib/ytClient';

const BATCH_SIZE = 400; // gửi cả bài trong một lần gọi AI (model lite xử lý khoảng 100 đoạn mỗi 8 giây)
const MIN_BATCH = 40; // lô nhỏ hơn mức này thì không chia nhỏ thêm
const MAX_AUTO_RETRIES = 3; // tự thử lại khi AI lỗi tạm thời
const SYNC_DELAY_MS = 2500;
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

// Bài lưu bằng cách chia câu cũ -> tự chia lại khi mở
const needsUpgrade = (lesson) => (lesson.v ?? 1) < SEG_VERSION;

const failureMessage = (out) =>
  out.code === 'NO_LOGIN' ? 'Phiên đăng nhập đã hết hạn. Bấm "Dịch lại" để đăng nhập Google và dịch tiếp.' : (out.message ?? 'Không dịch được. Thử lại sau.');

function Lesson({ videoId }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([]); // chỉ là phần đang HIỂN THỊ; bản đầy đủ nằm trong sentencesRef
  const [shown, setShown] = useState(false); // đã hiện phụ đề lần đầu chưa (trước đó chỉ hiện khung chờ)
  const [phase, setPhase] = useState('loading'); // loading | login | translating | ready | error
  const [error, setError] = useState('');
  const [translateFailed, setTranslateFailed] = useState(false);
  const [usage, setUsage] = useState(null);
  const [note, setNote] = useState('');
  const [attempt, setAttempt] = useState(0); // tăng lên để chạy lại sau khi đăng nhập
  const sentencesRef = useRef([]);
  const titleRef = useRef('');
  const metaRef = useRef({ v: SEG_VERSION });
  const runId = useRef(0);
  const [sync] = useState(() => ({ timer: null }));

  // Đẩy bài lên Drive của người dùng (nếu đã đăng nhập và cấp quyền), gộp nhiều lần lưu liên tiếp thành một
  const syncNow = useCallback(() => {
    sync.timer = null;
    const session = getSession();
    if (!session?.drive || sentencesRef.current.length === 0) return;
    uploadLesson(session.token, videoId, { title: titleRef.current, sentences: sentencesRef.current, ...metaRef.current }).catch(() => {});
  }, [sync, videoId]);

  // Cập nhật bản đầy đủ và lưu lại. display = false: chưa hiện lên màn hình (đang chờ AI xong cả lô).
  const commit = useCallback(
    (next, { title: nextTitle = titleRef.current, meta = metaRef.current, display = true, sync: syncToDrive = true } = {}) => {
      sentencesRef.current = next;
      titleRef.current = nextTitle;
      metaRef.current = meta;
      setTitle(nextTitle);
      if (display) {
        setSentences(next);
        setShown(true);
      }
      saveLesson(videoId, { title: nextTitle, sentences: next, ...meta });
      if (syncToDrive) {
        clearTimeout(sync.timer);
        sync.timer = setTimeout(syncNow, SYNC_DELAY_MS);
      }
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

  // Thêm dấu câu và dịch tất cả các đoạn chưa có bản dịch bằng MỘT lần gọi AI cho cả bài (nhanh hơn chia nhỏ).
  // Chỉ khi xong mới hiện phụ đề. Lô quá lớn / chạy quá giờ thì tự chia đôi; AI lỗi tạm thời thì tự thử lại.
  const enrichAll = useCallback(
    async (id) => {
      setTranslateFailed(false);
      setPhase('translating');

      async function enrichBatch(indices) {
        let failures = 0;
        for (;;) {
          if (id !== runId.current) return { ok: false, cancelled: true };
          const current = sentencesRef.current;
          const res = await postJson(
            '/api/youtube/process',
            { mode: 'enrich', videoId, lines: indices.map((i) => current[i].text) },
            authHeader(getSession()),
          ).catch(() => ({ ok: false, data: {}, status: 0 }));
          if (id !== runId.current) return { ok: false, cancelled: true };
          if (res.data.usage) setUsage(res.data.usage);

          if (res.ok) {
            const next = sentencesRef.current.map((s) => ({ ...s }));
            indices.forEach((i, n) => {
              next[i].text = res.data.lines[n] || next[i].text;
              next[i].vi = res.data.vi[n] || '—';
            });
            commit(next, { display: false, sync: false });
            return { ok: true };
          }

          const { code, upstreamStatus } = res.data;
          // AI trả sai số lượng, hoặc chạy quá giờ (lô quá lớn): chia đôi rồi làm lần lượt
          const tooBig = code === 'BAD_OUTPUT' || (code === 'GEMINI' && !upstreamStatus) || (!code && res.status >= 500);
          if (tooBig && indices.length > MIN_BATCH) {
            setNote('vui lòng chờ thêm một chút');
            const mid = Math.ceil(indices.length / 2);
            const first = await enrichBatch(indices.slice(0, mid));
            if (!first.ok) return first;
            return enrichBatch(indices.slice(mid));
          }
          // Lỗi tạm thời (quá tải, mất mạng...): chờ rồi thử lại, nghe theo thời gian Google yêu cầu nếu có
          if ((!code || TRANSIENT_CODES.includes(code)) && failures < MAX_AUTO_RETRIES) {
            const wait = Math.min(45, res.data.retryAfter ?? 2 ** (failures + 1));
            setNote(`đang bận, tự thử lại sau ${Math.ceil(wait)} giây`);
            await sleep(wait * 1000);
            if (id !== runId.current) return { ok: false, cancelled: true };
            setNote('');
            failures++;
            continue;
          }
          return { ok: false, code, message: res.data.message };
        }
      }

      const missing = [];
      sentencesRef.current.forEach((s, i) => {
        if (!s.vi) missing.push(i);
      });
      const result = missing.length > 0 ? await enrichBatch(missing.slice(0, BATCH_SIZE)) : { ok: true };
      // Nếu còn thừa (bài rất dài) thì làm tiếp phần còn lại
      let outcome = result;
      for (let from = BATCH_SIZE; outcome.ok && from < missing.length; from += BATCH_SIZE) {
        outcome = await enrichBatch(missing.slice(from, from + BATCH_SIZE));
      }
      if (id !== runId.current) return;

      setNote('');
      commit(sentencesRef.current, { display: false }); // lưu lần cuối và đồng bộ Drive
      setSentences(sentencesRef.current);
      setShown(true);
      if (!outcome.ok) {
        setTranslateFailed(true);
        setError(failureMessage(outcome));
      }
      setPhase('ready');
    },
    [commit, videoId],
  );

  // "Dịch lại": chỉ hiện khi tự thử lại vẫn lỗi. Hết phiên đăng nhập thì mở cửa sổ đăng nhập rồi dịch tiếp.
  const retryTranslate = useCallback(async () => {
    const session = getSession() ?? (await signIn().catch(() => null));
    if (session) enrichAll(runId.current);
  }, [enrichAll]);

  useEffect(() => {
    const id = ++runId.current;

    const fail = (message) => {
      setError(message);
      setPhase('error');
    };

    // Có sẵn bài (trên máy hoặc từ Drive): bài đã đủ bản dịch thì hiện ngay, còn thiếu thì chờ AI xong rồi mới hiện
    async function openLesson(lesson) {
      let list = lesson.sentences;
      const upgraded = needsUpgrade(lesson);
      if (upgraded) list = resplitSentences(list); // chia lại câu dài của bài cũ; câu bị chia sẽ được dịch lại
      const meta = { v: SEG_VERSION };
      if (upgraded) commit(list, { title: lesson.title ?? videoId, meta, display: false, sync: false });
      else {
        sentencesRef.current = list;
        titleRef.current = lesson.title ?? videoId;
        metaRef.current = meta;
        setTitle(titleRef.current);
      }
      if (list.every((s) => s.vi)) {
        if (upgraded) commit(list, { display: false });
        setSentences(list);
        setShown(true);
        setPhase('ready');
        return;
      }
      setPhase('translating');
      await ensureSession().catch(() => null); // làm mới phiên đăng nhập im lặng nếu hết hạn
      if (id !== runId.current) return;
      await enrichAll(id);
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

      // 5. Ghép các dòng phụ đề thành đoạn ngắn theo mốc thời gian (chưa hiện), rồi nhờ AI thêm dấu câu và dịch cả bài một lượt
      commit(mergeSentences(transcript.segments), { title: transcript.title, meta: { v: SEG_VERSION }, display: false, sync: false });
      await enrichAll(id);
    }

    run();
    return () => {
      runId.current = id + 1; // hủy lượt chạy đang dở khi rời trang
    };
  }, [videoId, router, commit, enrichAll, attempt]);

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
  if (phase === 'loading') return <LessonSkeleton caption="Đang lấy phụ đề của video..." />;

  const translating = phase === 'translating';
  const done = sentences.filter((s) => s.vi).length;
  const status = translateFailed
    ? { text: `${error} (đã dịch ${done}/${sentences.length} câu)`, retry: true }
    : translating
      ? { text: `Đang dịch${note ? ` · ${note}` : '...'}` }
      : null;

  return (
    <YouTubePlayer
      videoId={videoId}
      title={title}
      sentences={sentences}
      status={status}
      usage={usage}
      pending={translating && !shown}
      translating={translating}
      onRetryTranslate={retryTranslate}
    />
  );
}

function Message({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-center text-sm text-slate-500">
      <div className="max-w-md">{children}</div>
    </div>
  );
}
