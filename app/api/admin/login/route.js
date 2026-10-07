import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, SESSION_SECONDS, authConfigured, checkCredentials, createSessionToken } from '../../../../lib/auth';

export async function POST(request) {
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
