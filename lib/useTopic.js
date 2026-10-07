'use client';
import { useEffect, useState } from 'react';

// Tải 1 topic đầy đủ từ /api/topics?topic=...; trả về { topic, failed, loading }
export function useTopic(name) {
  const [state, setState] = useState({ name: null, topic: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics?topic=${encodeURIComponent(name)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((json) => !cancelled && setState({ name, topic: json.topic, failed: false }))
      .catch(() => !cancelled && setState({ name, topic: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [name]);

  const loading = state.name !== name;
  return { loading, topic: loading ? null : state.topic, failed: !loading && state.failed };
}

// Tải 1 bài đầy đủ (text + segments + audio_url) từ /api/topics?topic=...&lesson=...
export function useTopicLesson(name, lessonIndex) {
  const key = `${name}/${lessonIndex}`;
  const [state, setState] = useState({ key: null, lesson: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics?topic=${encodeURIComponent(name)}&lesson=${encodeURIComponent(lessonIndex)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((json) => !cancelled && setState({ key, lesson: json.lesson, failed: false }))
      .catch(() => !cancelled && setState({ key, lesson: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [name, lessonIndex, key]);

  const loading = state.key !== key;
  return { loading, lesson: loading ? null : state.lesson, failed: !loading && state.failed };
}

// Tham số URL có thể còn ở dạng %-encode tùy phiên bản Next
export function decodeParam(value) {
  try {
    return decodeURIComponent(value ?? '');
  } catch {
    return value ?? '';
  }
}
