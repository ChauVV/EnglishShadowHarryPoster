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
export const saveKey = (value) => write(KEY, value.trim());
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

export function saveLesson(videoId, { title, sentences }) {
  const index = parse(read(INDEX), []).filter((e) => e.id !== videoId);
  const entry = { id: videoId, title: title ?? videoId, count: sentences.length, savedAt: Date.now() };
  const payload = JSON.stringify({ title: entry.title, sentences });
  let ok = write(LESSON + videoId, payload);
  // Đầy bộ nhớ: xóa dần các bài cũ nhất rồi thử lại
  while (!ok && index.length > 0) {
    write(LESSON + index.pop().id, null);
    ok = write(LESSON + videoId, payload);
  }
  if (ok) write(INDEX, JSON.stringify([entry, ...index].slice(0, 30)));
}

export const useLessonIndex = () => {
  const raw = useRaw(INDEX);
  return useMemo(() => parse(raw, []), [raw]);
};
