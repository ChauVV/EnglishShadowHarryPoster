import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (username === 'admin' && password === 'vvC@123123') {
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_token', 'authenticated', {
        httpOnly: true,
        path: '/',
        maxAge: 86400,
      });
      return response;
    }
    return NextResponse.json({ success: false, message: 'Sai thông tin đăng nhập' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
  }
}
