import { Suspense } from 'react';
import WatchClient from './WatchClient';

export const metadata = { title: 'Bài học từ YouTube · English Shadowing' };

// useSearchParams ở client component cần Suspense khi cacheComponents bật
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WatchClient />
    </Suspense>
  );
}
