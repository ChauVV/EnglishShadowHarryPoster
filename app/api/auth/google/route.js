import { NextResponse } from 'next/server';
import {
  DRIVE_SCOPE,
  REFRESH_COOKIE,
  clientPayload,
  codeFlowConfigured,
  cookieOptions,
  exchangeCode,
  readIdToken,
  sameOrigin,
  seal,
  unseal,
} from '../../../../lib/googleOAuth';
import { rateLimited } from '../../../../lib/rateLimit';

const fail = (status, code) => NextResponse.json({ code }, { status });

// POST /api/auth/google  { code }: đổi mã đăng nhập (từ cửa sổ Google) lấy access token và refresh token.
// Refresh token chỉ nằm trong cookie mã hóa httpOnly; trình duyệt chỉ nhận access token ngắn hạn.
export async function POST(request) {
  if (!codeFlowConfigured()) return fail(503, 'NO_CODE_FLOW');
  if (!sameOrigin(request)) return fail(403, 'BAD_ORIGIN');
  if (rateLimited(request, { limit: 20 })) return fail(429, 'TOO_MANY');

  const { code } = (await request.json().catch(() => null)) ?? {};
  if (typeof code !== 'string' || code.length < 5 || code.length > 2048) return fail(400, 'BAD_REQUEST');

  const result = await exchangeCode(code).catch(() => null);
  if (!result?.ok) {
    console.warn('[auth] đổi mã đăng nhập thất bại', result?.status, result?.data?.error);
    return fail(401, 'BAD_CODE');
  }

  const profile = readIdToken(result.data.id_token);
  if (!profile || profile.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return fail(401, 'BAD_CODE');
  const info = { email: profile.email, picture: profile.picture, drive: String(result.data.scope ?? '').includes(DRIVE_SCOPE) };

  // Google chỉ trả refresh token ở lần cấp quyền đầu; lần sau thiếu thì giữ cái trong cookie cũ (nếu cùng tài khoản)
  const previous = unseal(request.cookies.get(REFRESH_COOKIE)?.value);
  const refreshToken = result.data.refresh_token ?? (previous?.sub === profile.sub ? previous.rt : null);

  const response = NextResponse.json(clientPayload(result.data, info));
  if (refreshToken) response.cookies.set(REFRESH_COOKIE, seal({ rt: refreshToken, sub: profile.sub, ...info }), cookieOptions());
  return response;
}
