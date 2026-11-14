import { NextResponse } from 'next/server';
import { REFRESH_COOKIE, clientPayload, codeFlowConfigured, cookieOptions, refreshAccess, sameOrigin, unseal } from '../../../../lib/googleOAuth';
import { rateLimited } from '../../../../lib/rateLimit';

const fail = (status, code) => NextResponse.json({ code }, { status });

// POST /api/auth/token: cấp access token mới bằng refresh token trong cookie. Chạy ngầm, người dùng không thấy gì.
export async function POST(request) {
  if (!codeFlowConfigured()) return fail(503, 'NO_CODE_FLOW');
  if (!sameOrigin(request)) return fail(403, 'BAD_ORIGIN');
  if (rateLimited(request, { limit: 60 })) return fail(429, 'TOO_MANY');

  const session = unseal(request.cookies.get(REFRESH_COOKIE)?.value);
  if (!session?.rt) return fail(401, 'NO_SESSION');

  const result = await refreshAccess(session.rt).catch(() => null);
  if (!result) return fail(502, 'UPSTREAM');
  if (!result.ok) {
    // Refresh token bị thu hồi hoặc hết hạn: xóa cookie để trình duyệt thôi thử, người dùng đăng nhập lại
    if (result.data?.error === 'invalid_grant') {
      const response = fail(401, 'SESSION_EXPIRED');
      response.cookies.set(REFRESH_COOKIE, '', cookieOptions(0));
      return response;
    }
    console.warn('[auth] làm mới access token thất bại', result.status, result.data?.error);
    return fail(502, 'UPSTREAM');
  }
  return NextResponse.json(clientPayload(result.data, session));
}
