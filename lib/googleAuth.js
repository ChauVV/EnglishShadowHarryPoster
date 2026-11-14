'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

// Đăng nhập Google bằng Google Identity Services. Cần NEXT_PUBLIC_GOOGLE_CLIENT_ID (OAuth client loại "Web application",
// có origin của trang trong "Authorized JavaScript origins").
//
// Hai cách, tự chọn theo cấu hình của máy chủ (/api/auth/config):
//  1. Có GOOGLE_CLIENT_SECRET ("code flow"): cửa sổ Google chỉ hiện ở lần đăng nhập đầu. Máy chủ giữ refresh token trong cookie
//     mã hóa, nên mỗi lần cần access token mới (mỗi giờ, mỗi tab mới) trình duyệt xin NGẦM qua /api/auth/token, không hiện gì.
//  2. Chưa có GOOGLE_CLIENT_SECRET (cách cũ): token ngắn hạn, hết hạn là phải bấm đăng nhập lại. Không tự mở cửa sổ ngầm
//     nữa vì cửa sổ sẽ chớp lên rồi tắt.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'; // chỉ thư mục riêng của app, không thấy file khác của người dùng
const SCOPES = `openid email profile ${DRIVE_SCOPE}`;
const SESSION = 'yt-google-session'; // sessionStorage: access token sống tối đa ~1 giờ
const HINT = 'yt-google-hint'; // localStorage: đã từng đăng nhập (để biết có nên thử làm mới ngầm)
const EVENT = 'yt-google';
const REFRESH_EARLY_MS = 5 * 60_000; // làm mới access token trước khi hết hạn 5 phút

const signInError = (code, message) => Object.assign(new Error(message), { code });

let gisPromise;
function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = undefined;
      reject(signInError('SIGNIN_LOAD', 'Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

// Máy chủ có hỗ trợ đăng nhập một lần + làm mới ngầm không (null = chưa biết)
let codeFlow = null;
let configPromise;
function loadConfig() {
  configPromise ??= fetch('/api/auth/config')
    .then((r) => (r.ok ? r.json() : { codeFlow: false }))
    .catch(() => ({ codeFlow: false }))
    .then((c) => {
      codeFlow = Boolean(c.codeFlow);
      return codeFlow;
    });
  return configPromise;
}

// Nạp sẵn thư viện Google và cấu hình, để bấm nút đăng nhập mở được cửa sổ ngay
export function preloadGoogle() {
  loadConfig();
  return loadGoogleScript();
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

// { token, email, picture, drive, exp } hoặc null nếu chưa đăng nhập / token đã hết hạn
export const getSession = () => parseSession(readRaw());
export function useGoogleUser() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseSession(raw), [raw]);
}

const hasHint = () => {
  try {
    return Boolean(window.localStorage.getItem(HINT));
  } catch {
    return false;
  }
};
const setHint = (on) => {
  try {
    if (on) window.localStorage.setItem(HINT, '1');
    else window.localStorage.removeItem(HINT);
  } catch {
    // bỏ qua
  }
};

function store(session) {
  try {
    if (session) window.sessionStorage.setItem(SESSION, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION);
  } catch {
    // storage bị chặn -> phải đăng nhập lại mỗi lần tải trang
  }
  if (session) setHint(true);
  window.dispatchEvent(new Event(EVENT));
}

// Phản hồi của /api/auth/google và /api/auth/token -> phiên đăng nhập trong trình duyệt
const fromServer = (data) => ({
  token: data.access_token,
  email: data.email ?? null,
  picture: data.picture ?? null, // ảnh tài khoản Google, dùng làm ảnh đại diện mặc định
  drive: Boolean(data.drive),
  exp: Date.now() + Number(data.expires_in || 3600) * 1000,
});

// ---- làm mới ngầm bằng cookie (code flow); gộp các lần gọi cùng lúc thành một ----
let refreshing = null;
function refreshFromCookie() {
  refreshing ??= fetch('/api/auth/token', { method: 'POST' })
    .then(async (res) => {
      if (res.ok) {
        const session = fromServer(await res.json());
        store(session);
        return session;
      }
      // Cookie không còn dùng được (hết hạn, bị thu hồi, chưa từng có): thôi không thử nữa cho tới khi đăng nhập lại
      if (res.status === 401) setHint(false);
      return null;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Đăng nhập một lần bằng cửa sổ Google, nhận về mã để máy chủ đổi lấy access token + refresh token
async function signInWithCode() {
  await loadGoogleScript();
  const oauth = window.google.accounts.oauth2;
  const code = await new Promise((resolve) => {
    const client = oauth.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: (r) => resolve(r.error ? null : r.code),
      error_callback: () => resolve(null),
    });
    client.requestCode();
  });
  if (!code) return null;
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const session = fromServer(await res.json());
  store(session);
  return session;
}

// Cách cũ: token ngắn hạn, hết hạn là phải đăng nhập lại
async function signInWithToken() {
  await loadGoogleScript();
  const oauth = window.google.accounts.oauth2;
  const response = await new Promise((resolve) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (r) => resolve(r.error ? null : r),
      error_callback: () => resolve(null),
    });
    client.requestAccessToken({ prompt: '' });
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
    picture: info?.picture ?? null,
    drive: oauth.hasGrantedAllScopes(response, DRIVE_SCOPE), // người dùng có thể bỏ chọn quyền Drive ở màn hình đồng ý
    exp: Date.now() + Number(response.expires_in || 3600) * 1000,
  };
  store(session);
  return session;
}

// Mở cửa sổ đăng nhập Google. Phải gọi trực tiếp trong sự kiện bấm nút (trình duyệt mới cho mở cửa sổ).
export async function signIn() {
  if (!GOOGLE_CLIENT_ID) {
    console.error('Thiếu biến môi trường NEXT_PUBLIC_GOOGLE_CLIENT_ID (cấu hình đăng nhập Google).');
    throw signInError('SIGNIN_UNAVAILABLE', 'Google sign-in is not configured.');
  }
  if (codeFlow === null) await loadConfig();
  return codeFlow ? signInWithCode() : signInWithToken();
}

// Có phiên còn hạn thì dùng luôn; hết hạn thì làm mới NGẦM bằng cookie (không hiện cửa sổ nào). Không làm được -> null.
export async function ensureSession() {
  const current = getSession();
  if (current) return current;
  if (!hasHint()) return null; // chưa từng đăng nhập thì khỏi hỏi máy chủ
  if (codeFlow === null) await loadConfig();
  return codeFlow ? refreshFromCookie() : null;
}

// Trong lúc trang đang mở: tự làm mới access token trước khi nó hết hạn để phiên không bị đứt giữa chừng
export function useSessionKeepAlive() {
  const user = useGoogleUser();
  useEffect(() => {
    if (!user) return undefined;
    let timer;
    let cancelled = false; // trang đã đổi/phiên đã đổi trong lúc chờ cấu hình thì không đặt hẹn giờ nữa
    loadConfig().then((enabled) => {
      if (!enabled || cancelled) return;
      timer = setTimeout(() => refreshFromCookie(), Math.max(5_000, user.exp - Date.now() - REFRESH_EARLY_MS));
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user]);
}

export function signOut() {
  const session = getSession();
  if (session && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(session.token, () => {});
  // Thu hồi refresh token ở Google và xóa cookie (nếu đang dùng code flow)
  if (codeFlow !== false) fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); // cả khi chưa biết cấu hình, để chắc chắn xóa cookie
  setHint(false);
  store(null);
}

export const authHeader = (session) => (session ? { Authorization: `Bearer ${session.token}` } : {});

// Tiêu đề xác thực luôn mới: nếu access token sắp/đã hết hạn thì làm mới ngầm trước
export async function freshAuthHeader() {
  return authHeader(await ensureSession());
}
