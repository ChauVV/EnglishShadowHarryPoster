'use client';
import { FiTrash2 } from 'react-icons/fi';
import { deleteYouTubeLesson } from '../lib/deleteLesson';

// Nút xóa một bài YouTube (có hỏi lại trước khi xóa). Màu sắc và vị trí do nơi dùng truyền vào qua className.
export default function DeleteLessonButton({ id, title, className = '' }) {
  const onClick = async (e) => {
    e.preventDefault(); // nút nằm cạnh thẻ link, không để click lọt xuống mở bài
    e.stopPropagation();
    if (!window.confirm(`Xóa bài "${title}"?\nBài sẽ bị xóa khỏi máy này và khỏi Drive của bạn.`)) return;
    const ok = await deleteYouTubeLesson(id);
    if (!ok) window.alert('Đã xóa trên máy này nhưng chưa xóa được bản lưu trong Drive. Bạn thử xóa lại khi có mạng.');
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Xóa bài ${title}`}
      title="Xóa bài"
      className={`flex h-8 w-8 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 ${className}`}
    >
      <FiTrash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
