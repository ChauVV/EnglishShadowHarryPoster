'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Đăng nhập Google bằng Google Identity Services (token ngắn hạn, không cần server giữ phiên).
// Cần NEXT_PUBLIC_GOOGLE_CLIENT_ID (OAuth client loại "Web application", có origin của trang trong "Authorized JavaScript origins").
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'; // chỉ thư mục riêng của app, không thấy file khác của người dùng
const SCOPES = `openid email ${DRIVE_SCOPE}`;
const SESSION = 'yt-google-session'; // sessionStorage: token sống tối đa ~1 giờ
const HINT = 'yt-google-hint'; // localStorage: email lần đăng nhập trước, để thử đăng nhập lại không cần hỏi
const EVENT = 'yt-google';

let gisPromise;
export function preloadGoogle() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = undefined;
      reject(new Error('Không tải được thư viện đăng nhập của Google.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

const readRaw = () => {
  try {
    return window.sessionStorage.getItem(SESSION);
  } catch {
    return null;
  }
};
const parseSession = (raw) => {
  try {
    const s = JSON.parse(raw);
    return s?.token && s.exp > Date.now() + 60_000 ? s : null; // còn dùng được ít nhất 1 phút
  } catch {
    return null;
  }
};
const subscribe = (callback) => {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
};

// { token, email, drive, exp } hoặc null nếu chưa đăng nhập / token đã hết hạn
export const getSession = () => parseSession(readRaw());
export function useGoogleUser() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseSession(raw), [raw]);
}

const hint = () => {
  try {
    return window.localStorage.getItem(HINT) ?? undefined;
  } catch {
    return undefined;
  }
};

function store(session) {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION, JSON.stringify(session));
      window.localStorage.setItem(HINT, session.email ?? '');
    } else {
      window.sessionStorage.removeItem(SESSION);
    }
  } catch {
    // storage bị chặn -> phải đăng nhập lại mỗi lần tải trang
  }
  window.dispatchEvent(new Event(EVENT));
}

// Mở cửa sổ đăng nhập Google. Phải gọi trực tiếp trong sự kiện bấm nút (trình duyệt mới cho mở cửa sổ).
// silent = true: thử đăng nhập lại không hiện giao diện (chỉ thành công nếu người dùng đã cấp quyền trước đó).
export async function signIn({ silent = false } = {}) {
  if (!GOOGLE_CLIENT_ID) {
    console.error('Thiếu biến môi trường NEXT_PUBLIC_GOOGLE_CLIENT_ID (cấu hình đăng nhập Google).');
    throw new Error('Đăng nhập Google hiện chưa sẵn sàng. Vui lòng thử lại sau.');
  }
  await preloadGoogle();
  const oauth = window.google.accounts.oauth2;
  const response = await new Promise((resolve) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (r) => resolve(r.error ? null : r),
      error_callback: () => resolve(null),
    });
    client.requestAccessToken({ prompt: silent ? 'none' : '', hint: hint() });
  });
  if (!response) return null;

  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${response.access_token}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const session = {
    token: response.access_token,
    email: info?.email ?? null,
    picture: info?.picture ?? null, // ảnh tài khoản Google, dùng làm ảnh đại diện mặc định
    drive: oauth.hasGrantedAllScopes(response, DRIVE_SCOPE), // người dùng có thể bỏ chọn quyền Drive ở màn hình đồng ý
    exp: Date.now() + Number(response.expires_in || 3600) * 1000,
  };
  store(session);
  return session;
}

// Token còn hạn thì dùng luôn; hết hạn thì thử đăng nhập lại im lặng (có thể thất bại -> trả về null)
export async function ensureSession() {
  const current = getSession();
  if (current) return current;
  if (!hint()) return null;
  return signIn({ silent: true }).catch(() => null);
}

export function signOut() {
  const session = getSession();
  if (session && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(session.token, () => {});
  try {
    window.localStorage.removeItem(HINT);
  } catch {
    // bỏ qua
  }
  store(null);
}

export const authHeader = (session) => (session ? { Authorization: `Bearer ${session.token}` } : {});
