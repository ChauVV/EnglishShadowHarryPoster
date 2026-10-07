import { Suspense } from 'react';
import TopicClient from './TopicClient';

// useParams() ở client component cần Suspense khi cacheComponents bật
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TopicClient />
    </Suspense>
  );
}
