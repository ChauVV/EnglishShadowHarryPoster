// Thống kê số lần gọi và số token Gemini mà CHÍNH APP NÀY đã dùng trong ngày (cho trang admin).
// Google không có API để hỏi "hạn mức còn lại của key": hạn mức tính theo dự án, mỗi model một mức, xem trong
// Google AI Studio; hạn mức theo ngày được làm mới vào nửa đêm giờ Thái Bình Dương. Nên số ở đây chỉ là phần app đã dùng.
//
// Kho lưu: Upstash Redis nếu đã cấu hình (số chính xác khi deploy), không thì bộ nhớ của tiến trình (chỉ gần đúng trên serverless).
import { redis, redisConfigured } from './usage';

const ZONE = 'America/Los_Angeles';
const memory = new Map(); // "<ngày>" -> { requests, prompt, output, total, limited, failed }

const day = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONE }); // YYYY-MM-DD theo giờ Thái Bình Dương

// Thời điểm hạn mức theo ngày của Google được làm mới (nửa đêm giờ Thái Bình Dương tiếp theo)
export function nextResetAt() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const secondsLeft = 86400 - (get('hour') * 3600 + get('minute') * 60 + get('second'));
  return new Date(Date.now() + secondsLeft * 1000).toISOString();
}

const empty = () => ({ requests: 0, prompt: 0, output: 0, total: 0, limited: 0, failed: 0 });

// status 200 = gọi thành công (kèm số token); 429 = bị giới hạn; còn lại = lỗi khác
export async function recordGemini({ prompt = 0, output = 0, total = 0, status = 200 } = {}) {
  const inc =
    status === 200
      ? { requests: 1, prompt: prompt || 0, output: output || 0, total: total || 0 }
      : status === 429
        ? { requests: 1, limited: 1 }
        : { requests: 1, failed: 1 };
  const key = day();
  try {
    if (redisConfigured()) {
      await redis([...Object.entries(inc).map(([field, n]) => ['HINCRBY', `yt:gemini:${key}`, field, n]), ['EXPIRE', `yt:gemini:${key}`, 259200]]);
      return;
    }
    for (const k of memory.keys()) if (k !== key) memory.delete(k); // bỏ số liệu của ngày cũ
    const current = memory.get(key) ?? empty();
    for (const [field, n] of Object.entries(inc)) current[field] += n;
    memory.set(key, current);
  } catch {
    // thống kê hỏng thì thôi, không được làm hỏng việc dịch
  }
}

// -> { day, requests, promptTokens, outputTokens, totalTokens, rateLimited, failed, resetAt, durable }
export async function getGeminiUsage() {
  const key = day();
  let data = empty();
  try {
    if (redisConfigured()) {
      const [flat] = await redis([['HGETALL', `yt:gemini:${key}`]]);
      for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) data[flat[i]] = Number(flat[i + 1]) || 0;
    } else {
      data = { ...empty(), ...(memory.get(key) ?? {}) };
    }
  } catch {
    // trả về số 0 nếu không đọc được
  }
  return {
    day: key,
    requests: data.requests,
    promptTokens: data.prompt,
    outputTokens: data.output,
    totalTokens: data.total,
    rateLimited: data.limited,
    failed: data.failed,
    resetAt: nextResetAt(),
    durable: redisConfigured(), // false: số chỉ tính trong tiến trình hiện tại, có thể thấp hơn thực tế
  };
}
