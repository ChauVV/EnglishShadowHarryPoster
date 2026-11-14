'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiTrash2 } from 'react-icons/fi';
import { deleteLessonFromDrive, deleteLessonOnThisDevice } from '../lib/deleteLesson';

// Nút xóa một bài YouTube, mở hộp thoại xác nhận. Màu sắc và vị trí nút do nơi dùng truyền vào qua className.
// beforeDelete: chạy khi bắt đầu xóa (ví dụ hủy việc đang dịch dở).
// onDeleted: chạy sau khi xóa xong (ví dụ quay về trang chủ).
export default function DeleteLessonButton({ id, title, className = '', beforeDelete, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('confirm'); // confirm | deleting | error

  const close = () => {
    setOpen(false);
    setPhase('confirm');
  };

  const finish = () => {
    deleteLessonOnThisDevice(id);
    close();
    onDeleted?.();
  };

  // Xóa trong Drive trước (hộp thoại còn nguyên và hiện vòng quay), thành công mới xóa trên máy
  const run = async () => {
    setPhase('deleting');
    await beforeDelete?.();
    const ok = await deleteLessonFromDrive(id);
    if (ok) finish();
    else setPhase('error');
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); // nút nằm cạnh thẻ link, không để click lọt xuống mở bài
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Xóa bài ${title}`}
        title="Xóa bài"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 ${className}`}
      >
        <FiTrash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <ConfirmDialog title={title} phase={phase} onCancel={close} onConfirm={run} onLocalOnly={finish} />
      )}
    </>
  );
}

function ConfirmDialog({ title, phase, onCancel, onConfirm, onLocalOnly }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const deleting = phase === 'deleting';

  // Khóa cuộn trang phía sau, đưa tiêu điểm vào nút Hủy, đóng bằng Esc, giữ phím Tab trong hộp thoại
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !deleting) {
        onCancel();
      } else if (e.key === 'Tab') {
        const items = [...(dialogRef.current?.querySelectorAll('button:not([disabled])') ?? [])];
        if (items.length === 0) return e.preventDefault();
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [deleting, onCancel]);

  const failed = phase === 'error';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="dialog-in w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <FiTrash2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="delete-title" className="font-display mt-4 text-lg font-semibold">
          {failed ? 'Chưa xóa được trong Drive' : 'Xóa bài học này?'}
        </h2>
        <div id="delete-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          {failed ? (
            <p>
              Không kết nối được Drive nên bản lưu ở đó chưa bị xóa. Bạn có thể thử lại, hoặc chỉ xóa trên máy này (bản trong Drive có thể hiện lại khi bạn đăng nhập).
            </p>
          ) : (
            <>
              <p className="line-clamp-2 font-medium text-slate-900">{title}</p>
              <p className="mt-1">Bài sẽ bị xóa khỏi máy này và khỏi Drive của bạn. Bạn không thể hoàn tác.</p>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {failed ? (
            <button
              type="button"
              onClick={onLocalOnly}
              className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Chỉ xóa trên máy
            </button>
          ) : (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            {deleting && <Spinner />}
            {deleting ? 'Đang xóa...' : failed ? 'Thử lại' : 'Xóa bài'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
