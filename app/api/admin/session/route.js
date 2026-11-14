import { NextResponse, connection } from 'next/server';
import { isAdminRequest } from '../../../../lib/auth';

export async function GET(request) {
  await connection(); // luôn chạy theo từng yêu cầu; nếu không Next dựng sẵn lúc build và cache kết quả "admin: false" cả năm
  return NextResponse.json({ admin: isAdminRequest(request) });
}
