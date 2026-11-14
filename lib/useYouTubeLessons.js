'use client';
import { useEffect, useMemo, useState } from 'react';
import { LESSON_DELETED_EVENT } from './deleteLesson';
import { listLessons } from './driveSync';
import { useGoogleUser } from './googleAuth';
import { useLessonIndex } from './ytClient';

// Các bài YouTube của người dùng: gộp bài lưu trên máy và bài trong Drive (nếu đã đăng nhập), mới nhất đứng đầu.
// -> [{ id, title, count, savedAt }]
export function useYouTubeLessons() {
  const user = useGoogleUser();
  const local = useLessonIndex();
  const [drive, setDrive] = useState([]);
  const token = user?.drive ? user.token : null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listLessons(token)
      .then((list) => !cancelled && setDrive(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Bài vừa bị xóa: bỏ ngay khỏi danh sách Drive đang giữ để không hiện lại trong lúc chờ Drive xóa xong
  useEffect(() => {
    const onDeleted = (e) => setDrive((list) => list.filter((d) => d.videoId !== e.detail));
    window.addEventListener(LESSON_DELETED_EVENT, onDeleted);
    return () => window.removeEventListener(LESSON_DELETED_EVENT, onDeleted);
  }, []);

  return useMemo(() => {
    const byId = new Map(local.map((l) => [l.id, { id: l.id, title: l.title, count: l.count, savedAt: l.savedAt }]));
    if (token) {
      // Bài trên máy được ưu tiên; bài chỉ có trong Drive (tạo ở thiết bị khác) được thêm vào
      for (const d of drive) {
        if (!byId.has(d.videoId)) byId.set(d.videoId, { id: d.videoId, title: d.title, count: d.count, savedAt: d.savedAt });
      }
    }
    return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
  }, [local, drive, token]);
}
