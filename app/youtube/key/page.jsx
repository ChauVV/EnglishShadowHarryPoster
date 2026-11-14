import { Suspense } from 'react';
import KeyClient from './KeyClient';

export const metadata = { title: 'Tạo key youtube-transcript.ai · English Shadowing' };

// useSearchParams ở client component cần Suspense khi cacheComponents bật
export default function Page() {
  return (
    <Suspense fallback={null}>
      <KeyClient />
    </Suspense>
  );
}
