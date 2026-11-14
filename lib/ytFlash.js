'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { errorText } from './i18nYoutube';
import { nextResetLabel } from './ytClient';

// Lỗi khi tạo bài học: trang xem video lưu lại rồi đưa người dùng về trang chủ, trang chủ hiện popup cảnh báo.
// Lưu dưới dạng mã/số (không phải chữ) để chữ đúng ngôn ngữ đang chọn lúc hiển thị.
const FLASH = 'yt-flash';
const EVENT = 'yt-flash';

export function setFlash(error) {
  try {
    window.sessionStorage.setItem(FLASH, JSON.stringify(error ?? {}));
  } catch {
    // storage bị chặn: người dùng vẫn về trang chủ, chỉ không thấy popup
  }
}

const readRaw = () => {
  try {
    return window.sessionStorage.getItem(FLASH);
  } catch {
    return null;
  }
};
const subscribe = (callback) => {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
};

// [lỗi đang chờ hiện popup hoặc null, hàm đóng popup (xóa lỗi nên chỉ hiện một lần)]
export function useFlash() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const flash = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.removeItem(FLASH);
    } catch {
      // không xóa được thì popup không có để hiện từ đầu
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [flash, dismiss];
}

// error: { code, fallback } hoặc { limit } -> câu hiển thị
export const errorMessage = (y, e) => (!e ? '' : e.limit ? y.dailyLimitReset(e.limit, nextResetLabel()) : errorText(y, e.code, y.err[e.fallback] ?? y.err.generic));
