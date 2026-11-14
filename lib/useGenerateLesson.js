'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { findLesson } from './driveSync';
import { ensureSession, getSession, signIn } from './googleAuth';
import { useI18n } from './i18n';
import { errorText } from './i18nYoutube';
import { extractVideoId } from './youtube';
import { getKey, isValidKeyFormat, loadLesson } from './ytClient';

// Logic của nút Generate (dùng chung cho banner trang chủ và trang /youtube):
// kiểm tra link -> bài đã có thì mở luôn -> chưa đăng nhập thì đăng nhập Google -> chưa có key thì sang màn hình tạo key.
export function useGenerateLesson() {
  const router = useRouter();
  const { t } = useI18n();
  const y = t.yt;
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async (e) => {
    e.preventDefault();
    const id = extractVideoId(url);
    if (!id) {
      setError(y.err.badLink);
      return;
    }
    setError('');
    const watch = `/youtube/watch?v=${id}`;
    // Bài đã có trên máy: xem lại ngay, không cần đăng nhập, không cần key, không tốn lượt
    if (loadLesson(id)) return router.push(watch);

    // Phiên đã hết hạn thì làm mới ngầm trước (không hiện gì); chỉ khi chưa từng đăng nhập mới mở cửa sổ đăng nhập Google
    let session = getSession() ?? (await ensureSession());
    if (!session) {
      setBusy(true);
      session = await signIn().catch((err) => {
        setError(errorText(y, err.code, y.err.signInFailed));
        return null;
      });
      setBusy(false);
      if (!session) return setError((prev) => prev || y.err.signInFailed);
    }

    // Bài đã tạo trên thiết bị khác (có trong Drive): mở thẳng, không cần key
    if (session.drive && (await findLesson(session.token, id).catch(() => null))) return router.push(watch);

    router.push(isValidKeyFormat(getKey()) ? watch : `/youtube/key?v=${id}`);
  };

  return { url, setUrl, error, busy, generate };
}
