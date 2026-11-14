// Gọi Gemini API (REST) và ép trả về JSON. Key lấy từ GEMINI_API_KEY.
// - Model: GEMINI_MODEL nếu có; không thì dùng model mặc định (bản "flash-lite": nhanh và hạn mức miễn phí rộng).
//   Nếu Google báo model đó không còn (404) thì tự tìm model mới nhất còn dùng được và nhớ lại cho các lần sau.
// - Tắt "suy nghĩ" của model (thinkingBudget: 0) để nhanh: để mặc định thì model mới có thể mất hàng chục
//   giây đến vài phút cho một việc dịch đơn giản. Model nào từ chối cấu hình này thì gọi lại không kèm nó.
const ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

let autoModel = null; // model tự chọn khi model mặc định không còn
const noThinkingConfig = new Set(); // các model từ chối cấu hình tắt suy nghĩ

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const currentModel = () => process.env.GEMINI_MODEL || autoModel || DEFAULT_MODEL;

export class GeminiError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter; // giây, nếu Google cho biết bao lâu nữa thì thử lại được (lỗi 429)
  }
}

const headers = () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY });

function generate(model, prompt, schema, withThinkingConfig) {
  const generationConfig = { responseMimeType: 'application/json', temperature: 0.2 };
  if (schema) generationConfig.responseSchema = schema;
  if (withThinkingConfig) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return fetch(`${ROOT}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    signal: AbortSignal.timeout(50_000),
  });
}

// Model thay thế khi model mặc định bị ngừng: bản flash-lite ổn định mới nhất, không có thì flash ổn định mới nhất
async function findReplacementModel() {
  const best = { lite: null, flash: null };
  let pageToken;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${ROOT}/models`);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    for (const m of data.models ?? []) {
      const match = m.name?.match(/^models\/(gemini-(\d+(?:\.\d+)?)-flash(-lite)?)$/);
      if (!match || !m.supportedGenerationMethods?.includes('generateContent')) continue;
      const kind = match[3] ? 'lite' : 'flash';
      const version = Number(match[2]);
      if (!best[kind] || version > best[kind].version) best[kind] = { name: match[1], version };
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return (best.lite ?? best.flash)?.name ?? null;
}

async function errorFrom(res) {
  const detail = await res.json().catch(() => null);
  const retry = detail?.error?.details?.find((d) => String(d['@type']).endsWith('RetryInfo'))?.retryDelay; // ví dụ "34s"
  const retryAfter = Number.parseFloat(retry ?? res.headers.get('retry-after')) || undefined;
  return new GeminiError(res.status, detail?.error?.message ?? `Gemini trả về lỗi ${res.status}`, retryAfter);
}

export async function geminiJson(prompt, { schema } = {}) {
  const pinned = process.env.GEMINI_MODEL;
  let model = pinned || autoModel || DEFAULT_MODEL;
  let res = await generate(model, prompt, schema, !noThinkingConfig.has(model));

  // Model mặc định đã bị Google ngừng: chuyển sang model thay thế
  if (res.status === 404 && !pinned) {
    const found = await findReplacementModel().catch(() => null);
    if (found && found !== model) {
      console.warn(`Model Gemini "${model}" không còn dùng được, chuyển sang "${found}".`);
      autoModel = found;
      model = found;
      res = await generate(model, prompt, schema, !noThinkingConfig.has(model));
    }
  }

  // Model từ chối cấu hình tắt suy nghĩ: gọi lại không kèm cấu hình đó, nếu được thì nhớ cho model này
  if (res.status === 400 && !noThinkingConfig.has(model)) {
    const retry = await generate(model, prompt, schema, false);
    if (retry.ok) {
      console.warn(`Model Gemini "${model}" không hỗ trợ tắt suy nghĩ, từ giờ gọi không kèm cấu hình đó.`);
      noThinkingConfig.add(model);
    }
    res = retry;
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
