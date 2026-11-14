// Gọi Gemini API (REST) và ép trả về JSON. Key lấy từ GEMINI_API_KEY.
// Model: GEMINI_MODEL nếu có; không thì dùng model mặc định, và nếu Google báo model đó không còn (404)
// thì tự tìm model "flash" mới nhất còn dùng được rồi nhớ lại cho các lần sau.
const ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';

let autoModel = null; // model tự chọn khi model mặc định không còn

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

export class GeminiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const headers = () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY });

function generate(model, prompt) {
  return fetch(`${ROOT}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
}

// Tìm model gemini-<phiên bản>-flash (không hậu tố như image/tts/lite) mới nhất hỗ trợ generateContent
async function findFlashModel() {
  let best = null;
  let pageToken;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${ROOT}/models`);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    for (const m of data.models ?? []) {
      const match = m.name?.match(/^models\/(gemini-(\d+(?:\.\d+)?)-flash)$/);
      if (!match || !m.supportedGenerationMethods?.includes('generateContent')) continue;
      const version = Number(match[2]);
      if (!best || version > best.version) best = { name: match[1], version };
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return best?.name ?? null;
}

async function errorFrom(res) {
  const detail = await res.json().catch(() => null);
  return new GeminiError(res.status, detail?.error?.message ?? `Gemini trả về lỗi ${res.status}`);
}

export async function geminiJson(prompt) {
  const pinned = process.env.GEMINI_MODEL;
  let model = pinned || autoModel || DEFAULT_MODEL;
  let res = await generate(model, prompt);

  if (res.status === 404 && !pinned) {
    const found = await findFlashModel().catch(() => null);
    if (found && found !== model) {
      console.warn(`Model Gemini "${model}" không còn dùng được, chuyển sang "${found}".`);
      autoModel = found;
      model = found;
      res = await generate(model, prompt);
    }
  }
  if (!res.ok) throw await errorFrom(res);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(502, 'Gemini trả về dữ liệu không phải JSON');
  }
}
