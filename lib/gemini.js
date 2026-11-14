// Gọi Gemini API (REST) và ép trả về JSON. Key lấy từ GEMINI_API_KEY, model từ GEMINI_MODEL.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

export class GeminiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function geminiJson(prompt) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new GeminiError(res.status, detail?.error?.message ?? `Gemini trả về lỗi ${res.status}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(502, 'Gemini trả về dữ liệu không phải JSON');
  }
}
