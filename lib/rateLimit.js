// Giới hạn tần suất đơn giản theo IP, lưu trong bộ nhớ của tiến trình.
// Chỉ đủ để chặn lạm dụng nhẹ khi chạy 1 máy; trên Vercel (serverless) mỗi instance đếm riêng,
// khi mở rộng cần dùng kho chung (Redis/KV) và đăng nhập.
const hits = new Map();

export function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

export function rateLimited(request, { limit = 40, windowMs = 60_000 } = {}) {
  const key = clientIp(request);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > limit;
}
