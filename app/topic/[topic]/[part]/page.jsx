import { Suspense } from 'react';
import LessonClient from './LessonClient';

// useParams() ở client component cần Suspense khi cacheComponents bật
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LessonClient />
    </Suspense>
  );
}
