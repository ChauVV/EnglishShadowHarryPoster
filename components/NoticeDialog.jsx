'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle } from 'react-icons/fi';

// Hộp thoại cảnh báo một nút (kiểu giống hộp thoại xóa bài): khóa cuộn trang, đóng bằng Esc / bấm nền / nút OK.
export default function NoticeDialog({ title, message, okLabel, onClose }) {
  const okRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Tab') e.preventDefault(); // chỉ có một nút, giữ tiêu điểm trong hộp thoại
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="notice-title" aria-describedby="notice-desc" className="dialog-in w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 dark:ring-1 dark:ring-slate-700 p-6 text-slate-900 dark:text-slate-100 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
          <FiAlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="notice-title" className="font-display mt-4 text-lg font-semibold">
          {title}
        </h2>
        <p id="notice-desc" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {message}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="h-10 min-w-24 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
