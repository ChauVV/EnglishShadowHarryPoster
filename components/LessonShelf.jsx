'use client';
import Link from 'next/link';
import { useState } from 'react';

// Danh sách bài dạng lưới ảnh bìa, đặt ở khoảng trống dưới các nút điều khiển (dùng chung cho trang bài học topic và trang video YouTube).
// items: [{ id, href, title, image, badge? }]; bài đang xem (currentId) được viền xanh và đánh dấu.
// Chỉ hiện ở màn hình rộng, nơi cột trái còn trống; trên điện thoại ưu tiên danh sách phụ đề.
export default function LessonShelf({ heading, items, currentId, nowPlayingLabel, seeAll, limit = 12 }) {
  if (items.length < 2) return null; // chỉ có bài đang xem thì không cần danh sách
  // Giới hạn số bài nhưng luôn giữ bài đang xem trong danh sách
  const currentIndex = items.findIndex((item) => item.id === currentId);
  const start = Math.max(0, Math.min(currentIndex - Math.floor(limit / 2), items.length - limit));
  const shown = items.slice(start, start + limit);
  return (
    <section aria-label={heading} className="mx-auto hidden w-full max-w-[calc(60vh*16/9)] pt-2 lg:block">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {seeAll && (
          <Link href={seeAll.href} className="text-xs font-medium text-emerald-700 hover:underline">
            {seeAll.label}
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-3 xl:grid-cols-4">
        {shown.map((item) => (
          <ShelfItem key={item.id} item={item} current={item.id === currentId} nowPlayingLabel={nowPlayingLabel} />
        ))}
      </ul>
    </section>
  );
}

function ShelfItem({ item, current, nowPlayingLabel }) {
  const [failed, setFailed] = useState(false); // ảnh lỗi -> ô gradient + số bài
  return (
    <li>
      <Link href={item.href} aria-current={current ? 'page' : undefined} className="group block rounded-xl focus-visible:outline-none">
        <span
          className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 to-teal-400 text-white transition group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 ${
            current ? 'ring-2 ring-emerald-500' : 'group-hover:shadow-md'
          }`}
        >
          {failed || !item.image ? (
            <span className="font-display text-3xl font-semibold opacity-90 drop-shadow">{item.badge}</span>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
              {item.badge != null && (
                <span className="absolute bottom-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1.5 text-[10px] font-semibold tabular-nums">
                  {item.badge}
                </span>
              )}
            </>
          )}
          {current && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">{nowPlayingLabel}</span>}
        </span>
        <span className="mt-1.5 block line-clamp-2 text-xs font-medium leading-snug group-hover:text-emerald-700">{item.title}</span>
      </Link>
    </li>
  );
}
