import { NextResponse, connection } from 'next/server';
import { codeFlowConfigured } from '../../../../lib/googleOAuth';

// GET /api/auth/config -> { codeFlow }: máy chủ đã có GOOGLE_CLIENT_SECRET (đăng nhập một lần, làm mới ngầm) hay chưa
export async function GET() {
  await connection(); // đọc biến môi trường lúc chạy, không dựng sẵn lúc build
  return NextResponse.json({ codeFlow: codeFlowConfigured() });
}
