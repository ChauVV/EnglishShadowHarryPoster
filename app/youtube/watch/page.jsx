import { Suspense } from 'react';
import LessonSkeleton from '../../../components/LessonSkeleton';
import WatchClient from './WatchClient';

export const metadata = { title: 'YouTube lesson · English Shadowing' };

// useSearchParams ở client component cần Suspense khi cacheComponents bật; fallback là khung chờ để không bị trang trắng
export default function Page() {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <WatchClient />
    </Suspense>
  );
}
