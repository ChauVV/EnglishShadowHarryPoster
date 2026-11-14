import { NextResponse } from 'next/server';
import { REFRESH_COOKIE, cookieOptions, revokeToken, sameOrigin, unseal } from '../../../../lib/googleOAuth';

// POST /api/auth/logout: thu hồi refresh token ở Google (cố gắng hết sức) và xóa cookie
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ code: 'BAD_ORIGIN' }, { status: 403 });
  const session = unseal(request.cookies.get(REFRESH_COOKIE)?.value);
  if (session?.rt) await revokeToken(session.rt);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_COOKIE, '', cookieOptions(0));
  return response;
}
