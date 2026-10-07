import { NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../lib/auth';

export async function GET(request) {
  return NextResponse.json({ admin: isAdminRequest(request) });
}
