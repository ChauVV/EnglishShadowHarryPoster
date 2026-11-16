'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_THEME, THEMES, THEME_KEY } from './themeConfig';

// Giao diện sáng/tối: lưu trên localStorage của thiết bị (không theo tài khoản), mặc định sáng.
// Class "dark" trên <html> do script trong app/layout.js đặt trước khi trang hiện ra (không bị nháy sáng),
// sau đó ThemeSync giữ cho class luôn khớp với giá trị đã lưu, kể cả khi đổi ở tab khác.

let memoryTheme = null; // storage bị chặn: vẫn đổi được giao diện trong phiên này, chỉ không nhớ được lần sau
const listeners = new Set();

function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function readTheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    // bị chặn storage -> dùng giá trị trong bộ nhớ
  }
  return THEMES.includes(stored) ? stored : (memoryTheme ?? DEFAULT_THEME);
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  memoryTheme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // bị chặn storage -> chỉ mất tính năng nhớ giao diện
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return { theme, setTheme };
}

// Đặt trong layout: áp giá trị đã lưu lên <html> mỗi khi nó đổi (ở trang này hay ở tab khác)
export function ThemeSync() {
  const { theme } = useTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}
