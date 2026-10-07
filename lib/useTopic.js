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

// Tham số URL có thể còn ở dạng %-encode tùy phiên bản Next
export function decodeParam(value) {
  try {
    return decodeURIComponent(value ?? '');
  } catch {
    return value ?? '';
  }
}
