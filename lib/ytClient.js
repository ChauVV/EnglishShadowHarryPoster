'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Kho lưu trên trình duyệt cho tính năng học từ link YouTube:
//  - key youtube-transcript.ai của người dùng (không gửi đi đâu ngoài request lấy phụ đề)
//  - số lượt đã dùng trong ngày (theo header hạn mức mà dịch vụ trả về)
//  - các bài đã tạo (phụ đề + bản dịch) để xem lại không tốn lượt
const KEY = 'yt-transcript-key';
const QUOTA = 'yt-quota';
const INDEX = 'yt-lessons-index';
const LESSON = 'yt-lesson:';
const RAW = 'yt-raw:';
const EVENT = 'yt-storage';

export const GET_KEY_URL = 'https://youtube-transcript.ai/get-api-key';
export const DEFAULT_DAILY_LIMIT = 10;

function read(name) {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}
function write(name, value) {
  try {
    if (value === null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false; // storage bị chặn hoặc đầy
  }
}
function subscribe(callback) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
}
const useRaw = (name) => useSyncExternalStore(subscribe, () => read(name), () => null);

const parse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

// ---- key ----
export const isValidKeyFormat = (value) => /^yta_[\w-]{16,}$/.test(String(value ?? '').trim());
export const getKey = () => read(KEY)?.trim() || null;
export function saveKey(value) {
  const next = value.trim();
  if (read(KEY)?.trim() !== next) write(QUOTA, null); // key mới có hạn mức riêng: quên số lượt đã dùng của key cũ
  return write(KEY, next);
}
export const clearKey = () => write(KEY, null);
export const useStoredKey = () => useRaw(KEY);

// ---- hạn mức trong ngày (reset lúc 00:00 UTC) ----
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

export function saveQuota(quota) {
  if (!quota || !Number.isFinite(quota.remaining)) return;
  const previous = parse(read(QUOTA), null);
  const limit = Number.isFinite(quota.limit) && quota.limit > 0 ? quota.limit : (previous?.limit ?? DEFAULT_DAILY_LIMIT);
  write(QUOTA, JSON.stringify({ day: utcDay(), limit, remaining: quota.remaining }));
}

// { limit, used, remaining } hôm nay (UTC). Sang ngày mới thì coi như chưa dùng lượt nào.
export function useQuota() {
  const raw = useRaw(QUOTA);
  return useMemo(() => {
    const saved = parse(raw, null);
    const limit = saved?.limit ?? DEFAULT_DAILY_LIMIT;
    const remaining = saved && saved.day === utcDay() ? saved.remaining : limit;
    return { limit, remaining: Math.max(0, remaining), used: Math.max(0, limit - remaining) };
  }, [raw]);
}

// Giờ địa phương của lần làm mới tới (00:00 UTC)
export function nextResetLabel() {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---- bài đã tạo ----
export function loadLesson(videoId) {
  const lesson = parse(read(LESSON + videoId), null);
  return lesson && Array.isArray(lesson.sentences) && lesson.sentences.length > 0 ? lesson : null;
}

export function saveLesson(videoId, { title, sentences, ...extra }) {
  const all = parse(read(INDEX), []);
  const index = all.filter((e) => e.id !== videoId);
  // Giữ nguyên thời điểm tạo khi lưu lại (ví dụ dịch thêm) để thứ tự "mới nhất" không bị đảo
  const savedAt = all.find((e) => e.id === videoId)?.savedAt ?? Date.now();
  const entry = { id: videoId, title: title ?? videoId, count: sentences.length, savedAt };
  const payload = JSON.stringify({ title: entry.title, sentences, ...extra });
  let ok = write(LESSON + videoId, payload);
  // Đầy bộ nhớ: xóa dần các bài cũ nhất rồi thử lại
  while (!ok && index.length > 0) {
    removeLessonData(index.pop().id);
    ok = write(LESSON + videoId, payload);
  }
  if (ok) {
    const kept = [entry, ...index];
    for (const dropped of kept.slice(30)) removeLessonData(dropped.id); // chỉ giữ 30 bài gần nhất
    write(INDEX, JSON.stringify(kept.slice(0, 30)));
  }
}

function removeLessonData(videoId) {
  write(LESSON + videoId, null);
  write(RAW + videoId, null);
}

// Xóa hẳn một bài khỏi máy (nội dung, phụ đề thô và mục trong danh sách)
export function deleteLessonLocal(videoId) {
  removeLessonData(videoId);
  write(INDEX, JSON.stringify(parse(read(INDEX), []).filter((e) => e.id !== videoId)));
}

export const useLessonIndex = () => {
  const raw = useRaw(INDEX);
  return useMemo(() => parse(raw, []), [raw]);
};

// ---- phụ đề thô lấy từ dịch vụ, giữ lại cùng bài học ----
// Lỗi ở bước AI hoặc bấm "Tạo lại" (chia câu / dịch lại) đều dùng lại bản này nên không tốn thêm lượt lấy phụ đề.
export function loadRaw(videoId) {
  const raw = parse(read(RAW + videoId), null);
  return raw && Array.isArray(raw.segments) && raw.segments.length > 0 ? raw : null;
}
export const saveRaw = (videoId, data) => write(RAW + videoId, JSON.stringify(data));
