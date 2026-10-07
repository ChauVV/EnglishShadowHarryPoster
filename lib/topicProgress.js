'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Tiến độ các topic miễn phí, tách riêng với tiến độ Harry Potter: danh sách "<topic>/<lesson>" đã mở
const KEY = 'shadowing-topic-progress';
const listeners = new Set();

function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}
const readRaw = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const topicLessonKey = (topic, lesson) => `${topic}/${lesson}`;

export function useTopicProgress() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    try {
      return new Set(JSON.parse(raw ?? '[]'));
    } catch {
      return new Set();
    }
  }, [raw]);
}

export function markTopicLessonOpened(key) {
  try {
    const visited = new Set(JSON.parse(readRaw() ?? '[]'));
    visited.add(key);
    window.localStorage.setItem(KEY, JSON.stringify([...visited]));
    listeners.forEach((l) => l());
  } catch {
    // localStorage bị chặn -> chỉ mất tính năng nhớ tiến độ
  }
}
