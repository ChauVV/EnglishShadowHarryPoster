import { Suspense } from 'react';
import LearnClient from './LearnClient';

// useParams() ở client component cần Suspense khi cacheComponents bật (params chưa biết lúc build)
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LearnClient />
    </Suspense>
  );
}
