'use client';
import { deleteLessonFiles } from './driveSync';
import { ensureSession } from './googleAuth';
import { deleteLessonLocal } from './ytClient';

export const LESSON_DELETED_EVENT = 'yt-lesson-deleted';

// Xóa một bài YouTube: trên máy này ngay lập tức, và trong Drive của người dùng nếu đã đăng nhập.
// -> true nếu xóa xong ở mọi nơi có thể xóa; false nếu bản trong Drive chưa xóa được (mất mạng, hết quyền...)
export async function deleteYouTubeLesson(videoId) {
  deleteLessonLocal(videoId);
  // Báo cho các danh sách đang hiển thị bỏ bài này ngay, không chờ Drive
  window.dispatchEvent(new CustomEvent(LESSON_DELETED_EVENT, { detail: videoId }));

  const session = await ensureSession().catch(() => null);
  if (!session?.drive) return true; // chưa đăng nhập hoặc không dùng Drive: không có bản nào để xóa ở đó
  try {
    await deleteLessonFiles(session.token, videoId);
    return true;
  } catch {
    return false;
  }
}
