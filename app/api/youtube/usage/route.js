import { NextResponse } from 'next/server';
import { bearerToken, verifyGoogleToken } from '../../../../lib/serverAuth';
import { getUsage } from '../../../../lib/usage';

// GET /api/youtube/usage  (Authorization: Bearer <Google access token>) -> { used, limit } của hôm nay (UTC)
export async function GET(request) {
  const user = await verifyGoogleToken(bearerToken(request));
  if (!user) return NextResponse.json({ code: 'NO_LOGIN', message: 'Cần đăng nhập Google.' }, { status: 401 });
  try {
    return NextResponse.json(await getUsage(user.id));
  } catch {
    return NextResponse.json({ code: 'USAGE', message: 'Không đọc được số lượt dịch đã dùng.' }, { status: 502 });
  }
}
