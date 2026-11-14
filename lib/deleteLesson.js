'use client';
import { deleteLessonFiles } from './driveSync';
import { ensureSession } from './googleAuth';
import { deleteLessonLocal } from './ytClient';

export const LESSON_DELETED_EVENT = 'yt-lesson-deleted';

// Bước 1: xóa bản lưu trong Drive của người dùng (nếu đã đăng nhập và dùng Drive).
// -> true nếu xóa xong hoặc không có gì để xóa; false nếu chưa xóa được (mất mạng, hết quyền...)
export async function deleteLessonFromDrive(videoId) {
  const session = await ensureSession().catch(() => null);
  if (!session?.drive) return true; // chưa đăng nhập hoặc không dùng Drive: không có bản nào ở đó
  try {
    await deleteLessonFiles(session.token, videoId);
    return true;
  } catch {
    return false;
  }
}

// Bước 2: xóa trên máy này và báo cho các danh sách đang hiển thị bỏ bài đó.
// Làm ở bước cuối vì thẻ bài biến mất ngay sau đó, kéo theo hộp thoại xóa đang mở trên thẻ.
export function deleteLessonOnThisDevice(videoId) {
  deleteLessonLocal(videoId);
  window.dispatchEvent(new CustomEvent(LESSON_DELETED_EVENT, { detail: videoId }));
}
