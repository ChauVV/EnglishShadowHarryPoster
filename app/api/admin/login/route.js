import { NextResponse } from 'next/server';
import { rateLimited } from '../../../../lib/rateLimit';
import { ADMIN_COOKIE, SESSION_SECONDS, authConfigured, checkCredentials, createSessionToken } from '../../../../lib/auth';

export async function POST(request) {
  // Mỗi địa chỉ chỉ được thử 10 lần trong 15 phút, để mật khẩu đơn giản vẫn không bị đoán mò hàng loạt
  if (rateLimited(request, { limit: 10, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ success: false, message: 'Thử quá nhiều lần, hãy đợi ít phút rồi thử lại.' }, { status: 429 });
  }
  if (!authConfigured()) {
    return NextResponse.json({ success: false, message: 'Server chưa cấu hình tài khoản admin' }, { status: 500 });
  }
  try {
    const { username, password } = await request.json();
    if (checkCredentials(username ?? '', password ?? '')) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(ADMIN_COOKIE, createSessionToken(), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_SECONDS,
      });
      return response;
    }
    return NextResponse.json({ success: false, message: 'Sai thông tin đăng nhập' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
  }
}
