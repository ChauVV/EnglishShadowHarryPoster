import { NextResponse, connection } from 'next/server';
import { isAdminRequest } from '../../../../lib/auth';
import { GeminiError, currentModel, geminiConfigured, geminiJson } from '../../../../lib/gemini';
import { getGeminiUsage } from '../../../../lib/geminiUsage';

export const maxDuration = 30;

const explain = (status) => {
  if (status === 404) return 'Model đã bị Google ngừng và không tìm được model thay thế. Đặt biến GEMINI_MODEL sang model còn dùng được.';
  if (status === 429) return 'Hết hạn mức (quota) của key hoặc model này.';
  if (status === 400 || status === 401 || status === 403) return 'Key không hợp lệ, bị khóa hoặc không có quyền gọi model.';
  if (status === 0) return 'Không kết nối được Google hoặc chạy quá giờ.';
  return 'Gemini đang gặp sự cố.';
};

// GET /api/health/gemini (chỉ admin): gọi thử một yêu cầu nhỏ để biết Gemini còn hoạt động không
// -> { ok, model, ms } hoặc { ok: false, problem, status, detail }
export async function GET(request) {
  await connection(); // luôn chạy theo từng yêu cầu, không dựng sẵn lúc build
  if (!isAdminRequest(request)) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (!geminiConfigured()) return NextResponse.json({ ok: false, problem: 'Chưa có biến GEMINI_API_KEY.' });

  const started = Date.now();
  try {
    await geminiJson('Return the JSON array ["ok"].');
    return NextResponse.json({ ok: true, model: currentModel(), ms: Date.now() - started, usage: await getGeminiUsage() });
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 0;
    return NextResponse.json({
      ok: false,
      model: currentModel(),
      ms: Date.now() - started,
      status,
      problem: explain(status),
      detail: String(err.message).slice(0, 200),
      usage: await getGeminiUsage(),
    });
  }
}
