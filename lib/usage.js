// Đếm số video mỗi người dùng đã xử lý (dịch) trong ngày UTC, tối đa YT_DAILY_VIDEO_LIMIT (mặc định 10).
// Một video chỉ tính 1 lần dù gọi AI nhiều lần cho nó.
//
// Kho lưu: Upstash Redis qua REST nếu có UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (nên dùng khi deploy,
// vì serverless không giữ bộ nhớ giữa các lần chạy). Không có thì dùng bộ nhớ của tiến trình (đủ cho chạy thử ở máy bạn).
export const DAILY_LIMIT = Math.max(1, Number(process.env.YT_DAILY_VIDEO_LIMIT) || 10);

const memory = new Map(); // "<user>:<ngày>" -> Set(videoId)
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = () => Boolean(redisUrl() && redisToken());

const dayKey = (userId) => `yt:usage:${userId}:${new Date().toISOString().slice(0, 10)}`;

async function redis(commands) {
  const res = await fetch(`${redisUrl()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

// -> { allowed, used, limit }
export async function recordVideo(userId, videoId) {
  const key = dayKey(userId);
  if (redisConfigured()) {
    const [member, count] = await redis([['SISMEMBER', key, videoId], ['SCARD', key]]);
    if (member === 1) return { allowed: true, used: count, limit: DAILY_LIMIT };
    if (count >= DAILY_LIMIT) return { allowed: false, used: count, limit: DAILY_LIMIT };
    await redis([['SADD', key, videoId], ['EXPIRE', key, 172800]]);
    return { allowed: true, used: count + 1, limit: DAILY_LIMIT };
  }

  for (const k of memory.keys()) if (!k.endsWith(key.slice(-10))) memory.delete(k); // bỏ dữ liệu của ngày cũ
  const set = memory.get(key) ?? new Set();
  if (!set.has(videoId) && set.size >= DAILY_LIMIT) return { allowed: false, used: set.size, limit: DAILY_LIMIT };
  set.add(videoId);
  memory.set(key, set);
  return { allowed: true, used: set.size, limit: DAILY_LIMIT };
}

export async function getUsage(userId) {
  const key = dayKey(userId);
  if (redisConfigured()) return { used: (await redis([['SCARD', key]]))[0] ?? 0, limit: DAILY_LIMIT };
  return { used: memory.get(key)?.size ?? 0, limit: DAILY_LIMIT };
}
