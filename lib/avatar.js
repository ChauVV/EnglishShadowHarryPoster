'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { downloadAvatar } from './driveSync';
import { useGoogleUser } from './googleAuth';

// Ảnh đại diện: ảnh người dùng tự chọn (lưu trong Drive của họ, nhớ cả trên máy này) nếu có,
// không thì dùng ảnh tài khoản Google.
const KEY = 'yt-avatar';
const EVENT = 'yt-avatar-change';

const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const subscribe = (callback) => {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
};

// dataUrl = null để xóa ảnh trên máy này
export function saveLocalAvatar(dataUrl) {
  try {
    if (dataUrl) window.localStorage.setItem(KEY, dataUrl);
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage bị chặn hoặc đầy: ảnh chỉ còn trong Drive
  }
  window.dispatchEvent(new Event(EVENT));
}

// -> { src, custom }: src là ảnh sẽ hiển thị (hoặc null), custom = true nếu là ảnh người dùng tự chọn
export function useAvatar() {
  const user = useGoogleUser();
  const custom = useSyncExternalStore(subscribe, read, () => null);
  const token = user?.drive ? user.token : null;

  // Đăng nhập trên máy mới: lấy ảnh đã lưu trong Drive về
  useEffect(() => {
    if (!token || custom) return;
    let cancelled = false;
    downloadAvatar(token)
      .then((url) => !cancelled && url && saveLocalAvatar(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, custom]);

  return { src: custom || user?.picture || null, custom: Boolean(custom) };
}

// Cắt ảnh vuông ở giữa, thu nhỏ còn size x size và nén JPEG (vài chục KB) để lưu gọn.
// -> { blob, dataUrl }
export async function prepareAvatar(file, size = 256) {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một tệp ảnh.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh quá lớn (tối đa 15MB).');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này. Hãy thử ảnh JPG hoặc PNG.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Không xử lý được ảnh này.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { blob, dataUrl };
}
