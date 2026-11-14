// Xác thực người dùng bằng access token Google (lấy từ nút "Đăng nhập Google" ở trình duyệt).
// Server hỏi Google xem token còn hạn không và có đúng cấp cho app này (aud = Client ID) hay không.
const cache = new Map(); // token -> { user, until }

export const bearerToken = (request) => request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

export async function verifyGoogleToken(token) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || !token || token.length > 2048) return null;

  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const info = await res.json().catch(() => null);
  const sub = info?.sub ?? info?.user_id;
  if (!sub || (info.aud !== clientId && info.azp !== clientId)) return null;

  const user = { id: String(sub), email: info.email ?? null };
  const expiresMs = Number(info.expires_in) * 1000;
  cache.set(token, { user, until: Date.now() + Math.min(5 * 60_000, Number.isFinite(expiresMs) ? expiresMs : 0) });
  if (cache.size > 2000) cache.clear();
  return user;
}
