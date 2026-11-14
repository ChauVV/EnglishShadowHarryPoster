'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import LessonSkeleton from '../../../components/LessonSkeleton';
import YouTubePlayer from '../../../components/YouTubePlayer';
import { downloadLesson, findLesson, uploadLesson } from '../../../lib/driveSync';
import { authHeader, ensureSession, getSession, signIn } from '../../../lib/googleAuth';
import { SEG_VERSION, buildSentences, extractVideoId, mergeSentences } from '../../../lib/youtube';
import { clearKey, getKey, isValidKeyFormat, loadLesson, loadRaw, nextResetLabel, saveLesson, saveQuota, saveRaw } from '../../../lib/ytClient';

const WINDOW = 250; // số dòng phụ đề gửi AI mỗi lần (bài dài thì chia thành nhiều lần chạy song song)
const MIN_WINDOW = 60; // lần gọi nhỏ hơn mức này thì không chia nhỏ thêm
const CONCURRENCY = 3;
const MAX_AUTO_RETRIES = 3; // tự thử lại khi AI lỗi tạm thời
const SYNC_DELAY_MS = 2500;
const UPGRADE_RETRY_MS = 60 * 60 * 1000; // bài cũ đã đủ nội dung mà AI lỗi: một tiếng sau mới thử nâng cấp lại
const TRANSIENT_CODES = ['GEMINI', 'BAD_OUTPUT', 'USAGE', 'TOO_MANY'];
const FATAL_CODES = ['NO_LOGIN', 'NO_GEMINI', 'DAILY_LIMIT'];

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

const failureMessage = (failure) =>
  failure?.code === 'NO_LOGIN' ? 'Phiên đăng nhập đã hết hạn. Bấm "Dịch lại" để đăng nhập Google và dịch tiếp.' : (failure?.message ?? 'Không dịch được. Thử lại sau.');

function Lesson({ videoId }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([]); // phần đang HIỂN THỊ; bản đầy đủ nằm trong sentencesRef
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

  // Cập nhật bản đầy đủ và lưu lại; display = true thì hiện lên màn hình
  const commit = useCallback(
    (next, { title: nextTitle = titleRef.current, meta = metaRef.current, display = true } = {}) => {
      sentencesRef.current = next;
      titleRef.current = nextTitle;
      metaRef.current = meta;
      setTitle(nextTitle);
      if (display) {
        setSentences(next);
        setShown(true);
      }
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

  // Nhờ AI cắt lời thoại thành câu ngắn (theo dấu chấm; câu dài cắt sau dấu phẩy), thêm dấu câu và dịch đúng từng câu.
  // lines = [{ start, end, text }] (dòng phụ đề gốc, hoặc các đoạn của bài đã lưu).
  // Bài dài được chia thành nhiều cửa sổ chạy song song. Cửa sổ quá lớn / chạy quá giờ thì tự chia đôi; AI lỗi tạm thời thì tự thử lại.
  // -> { sentences, failed, failure } hoặc null nếu đã bị hủy. Cửa sổ nào lỗi hẳn thì giữ bản tiếng Anh chưa dịch của cửa sổ đó.
  const processLines = useCallback(
    async (id, lines) => {
      let stop = false; // gặp lỗi không thể tự khắc phục (hết phiên, hết lượt...) thì không gọi thêm

      async function runRange(a, b) {
        const part = lines.slice(a, b);
        let failures = 0;
        for (;;) {
          if (id !== runId.current) return { cancelled: true };
          const res = await postJson('/api/youtube/process', { mode: 'segment', videoId, lines: part.map((l) => l.text) }, authHeader(getSession())).catch(() => ({
            ok: false,
            data: {},
            status: 0,
          }));
          if (id !== runId.current) return { cancelled: true };
          if (res.data.usage) setUsage(res.data.usage);
          if (res.ok) return { sentences: buildSentences(part, res.data.pieces), failed: false };

          const { code, upstreamStatus } = res.data;
          console.warn('[youtube] xử lý AI lỗi', { status: res.status, code, upstreamStatus, detail: res.data.detail, lines: part.length });
          // AI trả sai hoặc chạy quá giờ (cửa sổ quá lớn): chia đôi rồi làm lần lượt
          const tooBig = code === 'BAD_OUTPUT' || (code === 'GEMINI' && !upstreamStatus) || (!code && res.status >= 500);
          if (tooBig && part.length > MIN_WINDOW) {
            setNote('vui lòng chờ thêm một chút');
            const mid = a + Math.ceil(part.length / 2);
            const first = await runRange(a, mid);
            if (first.cancelled) return first;
            const second = await runRange(mid, b);
            if (second.cancelled) return second;
            return { sentences: [...first.sentences, ...second.sentences], failed: first.failed || second.failed, failure: first.failure ?? second.failure };
          }
          // Lỗi tạm thời (quá tải, mất mạng...): chờ rồi thử lại, nghe theo thời gian Google yêu cầu nếu có
          if ((!code || TRANSIENT_CODES.includes(code)) && failures < MAX_AUTO_RETRIES) {
            const wait = Math.min(45, res.data.retryAfter ?? 2 ** (failures + 1));
            setNote(`đang bận, tự thử lại sau ${Math.ceil(wait)} giây`);
            await sleep(wait * 1000);
            if (id !== runId.current) return { cancelled: true };
            setNote('');
            failures++;
            continue;
          }
          if (FATAL_CODES.includes(code)) stop = true;
          return { sentences: mergeSentences(part), failed: true, failure: { code, message: res.data.message } };
        }
      }

      const ranges = [];
      for (let a = 0; a < lines.length; a += WINDOW) ranges.push([a, Math.min(lines.length, a + WINDOW)]);
      const results = new Array(ranges.length);
      let nextRange = 0;
      async function worker() {
        while (nextRange < ranges.length) {
          const k = nextRange++;
          const [a, b] = ranges[k];
          results[k] = stop ? { sentences: mergeSentences(lines.slice(a, b)), failed: true } : await runRange(a, b);
          if (results[k].cancelled) return;
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, worker));
      if (id !== runId.current || results.some((r) => !r || r.cancelled)) return null;
      return {
        sentences: results.flatMap((r) => r.sentences),
        failed: results.some((r) => r.failed),
        failure: results.find((r) => r.failure)?.failure,
      };
    },
    [videoId],
  );

  // Kết quả xử lý xong: lưu, hiện phụ đề kèm bản dịch (hoặc báo lỗi và hiện nút "Dịch lại" nếu có phần chưa dịch được)
  const finish = useCallback(
    (outcome, nextTitle = titleRef.current) => {
      setNote('');
      commit(outcome.sentences, { title: nextTitle, meta: { v: SEG_VERSION } });
      if (outcome.failed) {
        setTranslateFailed(true);
        setError(failureMessage(outcome.failure));
      }
      setPhase('ready');
    },
    [commit],
  );

  // "Dịch lại": chỉ hiện khi tự thử lại vẫn lỗi. Hết phiên đăng nhập thì mở cửa sổ đăng nhập rồi làm tiếp.
  const retryTranslate = useCallback(async () => {
    const session = getSession() ?? (await signIn().catch(() => null));
    if (!session) return;
    const id = runId.current;
    setTranslateFailed(false);
    setPhase('translating');
    const lines = sentencesRef.current.map(({ start, end, text }) => ({ start, end, text }));
    const outcome = await processLines(id, lines);
    if (outcome) finish(outcome);
  }, [processLines, finish]);

  // Hiện số lượt dịch đã dùng hôm nay ngay cả khi mở lại bài đã lưu (lúc đó không có lần gọi AI nào trả số này về)
  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let cancelled = false;
    fetch('/api/youtube/usage', { headers: authHeader(session) })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => !cancelled && u && setUsage((prev) => prev ?? u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = ++runId.current;

    const fail = (message) => {
      setError(message);
      setPhase('error');
    };

    // Có sẵn bài (trên máy hoặc từ Drive). Bài đã chia câu chuẩn và dịch đủ thì hiện ngay; bài cũ hoặc còn thiếu thì
    // tự xử lý lại bằng AI (hiện khung chờ) rồi mới hiện, không tốn lượt lấy phụ đề.
    async function openLesson(lesson) {
      const complete = lesson.sentences.every((s) => s.vi);
      const current = (lesson.v ?? 1) >= SEG_VERSION;
      const snoozed = lesson.skipUntil > Date.now(); // vừa nâng cấp thất bại, chưa thử lại ngay
      titleRef.current = lesson.title ?? videoId;
      setTitle(titleRef.current);
      if (complete && (current || snoozed)) {
        sentencesRef.current = lesson.sentences;
        metaRef.current = { v: lesson.v, skipUntil: lesson.skipUntil };
        setSentences(lesson.sentences);
        setShown(true);
        setPhase('ready');
        return;
      }

      setPhase('translating');
      await ensureSession().catch(() => null); // làm mới phiên đăng nhập im lặng nếu hết hạn
      if (id !== runId.current) return;
      const lines = lesson.sentences.map(({ start, end, text }) => ({ start, end, text }));
      const outcome = await processLines(id, lines);
      if (!outcome) return;
      if (outcome.failed && complete) {
        // Bài cũ đã dịch đủ mà AI đang lỗi: giữ nguyên bản cũ, không báo lỗi, một lúc sau mới thử nâng cấp lại
        setNote('');
        commit(lesson.sentences, { meta: { v: lesson.v, skipUntil: Date.now() + UPGRADE_RETRY_MS } });
        setPhase('ready');
        return;
      }
      finish(outcome);
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
        console.warn('[youtube] lấy phụ đề lỗi', { status: res.status, code: res.data.code });
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

      // 5. Nhờ AI cắt câu và dịch; trong lúc chờ chỉ hiện khung chờ
      titleRef.current = transcript.title;
      setTitle(transcript.title);
      setPhase('translating');
      const outcome = await processLines(id, transcript.segments);
      if (!outcome) return;
      finish(outcome, transcript.title);
    }

    run();
    return () => {
      runId.current = id + 1; // hủy lượt chạy đang dở khi rời trang
    };
  }, [videoId, router, commit, processLines, finish, attempt]);

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
