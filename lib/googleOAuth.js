// Đăng nhập Google kiểu "authorization code" + refresh token (chỉ chạy trên máy chủ).
// Cửa sổ Google chỉ hiện ở lần đăng nhập đầu; sau đó trình duyệt xin access token mới qua /api/auth/token mà không hiện gì.
// Refresh token được mã hóa (AES-256-GCM) và giữ trong cookie httpOnly, JavaScript trên trang không đọc được.
//
// Cấu hình: GOOGLE_CLIENT_SECRET (bí mật của OAuth client loại Web), tùy chọn SESSION_SECRET (khóa mã hóa cookie;
// không đặt thì dùng chính GOOGLE_CLIENT_SECRET). Thiếu GOOGLE_CLIENT_SECRET thì tự quay về cách cũ (mở cửa sổ mỗi giờ).
import crypto from 'node:crypto';

export const REFRESH_COOKIE = 'yt_rt';
export const REFRESH_COOKIE_SECONDS = 180 * 24 * 60 * 60;
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const clientId = () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
export const codeFlowConfigured = () => Boolean(clientId() && process.env.GOOGLE_CLIENT_SECRET);

// ---- mã hóa cookie ----
const key = () => crypto.createHash('sha256').update(`yt-refresh:${process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || ''}`).digest();

export function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function unseal(token) {
  try {
    const buf = Buffer.from(String(token ?? ''), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    return null; // sai khóa, bị sửa hoặc không phải cookie của app
  }
}

export const cookieOptions = (maxAge = REFRESH_COOKIE_SECONDS) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth', // chỉ gửi kèm các request tới /api/auth/*
  maxAge,
});

// Chặn request từ trang web khác (cookie SameSite=Lax đã chặn phần lớn, đây là lớp thứ hai)
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

// ---- gọi Google ----
async function tokenRequest(params) {
  const res = await fetch(process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// "postmessage" là redirect_uri đặc biệt của Google cho cửa sổ đăng nhập dạng popup (không cần đăng ký)
export const exchangeCode = (code) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: 'postmessage' });
export const refreshAccess = (refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

export async function revokeToken(token) {
  await fetch(process.env.GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => {});
}

// Đọc phần thông tin trong id_token mà Google trả trực tiếp qua kết nối bảo mật (không cần kiểm chữ ký)
export function readIdToken(idToken) {
  try {
    return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Phản hồi gửi cho trình duyệt: access token ngắn hạn + thông tin hiển thị
export const clientPayload = (data, profile) => ({
  access_token: data.access_token,
  expires_in: Number(data.expires_in) || 3600,
  email: profile.email ?? null,
  picture: profile.picture ?? null,
  drive: Boolean(profile.drive),
});
