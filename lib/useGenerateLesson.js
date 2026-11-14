'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { findLesson } from './driveSync';
import { getSession, signIn } from './googleAuth';
import { extractVideoId } from './youtube';
import { getKey, isValidKeyFormat, loadLesson } from './ytClient';

// Logic của nút Generate (dùng chung cho banner trang chủ và trang /youtube):
// kiểm tra link -> bài đã có thì mở luôn -> chưa đăng nhập thì đăng nhập Google -> chưa có key thì sang màn hình tạo key.
export function useGenerateLesson() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async (e) => {
    e.preventDefault();
    const id = extractVideoId(url);
    if (!id) {
      setError('Link YouTube không hợp lệ. Hãy dán link dạng youtube.com/watch?v=... hoặc youtu.be/...');
      return;
    }
    setError('');
    const watch = `/youtube/watch?v=${id}`;
    // Bài đã có trên máy: xem lại ngay, không cần đăng nhập, không cần key, không tốn lượt
    if (loadLesson(id)) return router.push(watch);

    // Chưa đăng nhập: mở cửa sổ đăng nhập Google (gọi ngay trong sự kiện bấm nút)
    let session = getSession();
    if (!session) {
      setBusy(true);
      session = await signIn().catch((err) => {
        setError(err.message);
        return null;
      });
      setBusy(false);
      if (!session) return setError((prev) => prev || 'Chưa đăng nhập được Google. Hãy thử lại.');
    }

    // Bài đã tạo trên thiết bị khác (có trong Drive): mở thẳng, không cần key
    if (session.drive && (await findLesson(session.token, id).catch(() => null))) return router.push(watch);

    router.push(isValidKeyFormat(getKey()) ? watch : `/youtube/key?v=${id}`);
  };

  return { url, setUrl, error, busy, generate };
}
